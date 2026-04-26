use tauri::{Manager, State};
use tauri::Emitter;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use mongodb::{Client, Database, bson::{doc, Document, Bson, self}};
use serde_json::Value;
use futures_util::StreamExt;
use std::sync::Arc;
use tokio::sync::Mutex;
use dotenvy::dotenv;
use std::env;

struct DbState {
    db: Arc<Mutex<Option<Database>>>,
}

#[tauri::command]
async fn cloud_sync_get(state: State<'_, DbState>, collection_name: String) -> Result<Vec<Value>, String> {
    let db_guard = state.db.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    let collection = db.collection::<Document>(&collection_name);

    let mut cursor = collection.find(None, None).await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    while let Some(result) = cursor.next().await {
        match result {
            Ok(doc) => {
                let json = serde_json::to_value(&doc).map_err(|e| e.to_string())?;
                results.push(json);
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(results)
}

#[tauri::command]
async fn cloud_sync_post(state: State<'_, DbState>, collection_name: String, data: Vec<Value>) -> Result<Value, String> {
    let db_guard = state.db.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    let collection = db.collection::<Document>(&collection_name);

    let mut processed = 0;
    for item in data {
        if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
            let bson_doc = match bson::to_bson(&item).map_err(|e| e.to_string())? {
                Bson::Document(mut d) => {
                    d.insert("synced", 1);
                    d.insert("last_cloud_sync", mongodb::bson::DateTime::now());
                    d
                }
                _ => return Err("Invalid data format".to_string()),
            };

            let filter = doc! { "id": id };
            let update = doc! { "$set": bson_doc };
            let options = mongodb::options::UpdateOptions::builder().upsert(true).build();
            
            collection.update_one(filter, update, options).await.map_err(|e| e.to_string())?;
            processed += 1;
        }
    }

    Ok(serde_json::json!({ "success": true, "processed": processed }))
}

#[tauri::command]
async fn cloud_get_active_sessions(state: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let db_guard = state.db.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    
    let five_minutes_ago = chrono::Utc::now() - chrono::Duration::minutes(5);
    let pipeline = vec![
        doc! { 
            "$match": { 
                "logout_time": Bson::Null, 
                "last_ping": { "$gt": five_minutes_ago.to_rfc3339() } 
            } 
        },
        doc! { 
            "$lookup": { 
                "from": "users", 
                "localField": "user_id", 
                "foreignField": "id", 
                "as": "user" 
            } 
        },
        doc! { "$unwind": "$user" },
        doc! { 
            "$project": { 
                "name": "$user.name", 
                "email": "$user.email", 
                "role": "$user.role", 
                "login_time": 1, 
                "last_ping": 1 
            } 
        }
    ];

    let mut cursor = db.collection::<Document>("sessions").aggregate(pipeline, None).await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    while let Some(result) = cursor.next().await {
        match result {
            Ok(doc) => results.push(serde_json::to_value(&doc).unwrap()),
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(results)
}

#[tauri::command]
async fn cloud_manage_users(state: State<'_, DbState>, action: String, user: Value) -> Result<Value, String> {
    let db_guard = state.db.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    let collection = db.collection::<Document>("users");

    let id = user.get("id").and_then(|v| v.as_str()).ok_or("Missing user ID")?;

    if action == "delete" {
        collection.update_one(doc! { "id": id }, doc! { "$set": { "is_deleted": 1, "updated_at": mongodb::bson::DateTime::now() } }, None)
            .await.map_err(|e| e.to_string())?;
    } else {
        let mut bson_user = match bson::to_bson(&user).map_err(|e| e.to_string())? {
            Bson::Document(d) => d,
            _ => return Err("Invalid user data".to_string()),
        };
        bson_user.insert("updated_at", mongodb::bson::DateTime::now());
        
        let options = mongodb::options::UpdateOptions::builder().upsert(true).build();
        collection.update_one(doc! { "id": id }, doc! { "$set": bson_user }, options)
            .await.map_err(|e| e.to_string())?;
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn cloud_get_proctoring_alerts(state: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let db_guard = state.db.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    let collection = db.collection::<Document>("proctoring_events");

    let options = mongodb::options::FindOptions::builder()
        .sort(doc! { "start_time": -1 })
        .limit(20)
        .build();

    let mut cursor = collection.find(None, options).await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    while let Some(result) = cursor.next().await {
        match result {
            Ok(doc) => results.push(serde_json::to_value(&doc).unwrap()),
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(results)
}

#[tauri::command]
async fn cloud_manage_tasks(state: State<'_, DbState>, action: String, task: Value) -> Result<Value, String> {
    let db_guard = state.db.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    let collection = db.collection::<Document>("tasks");

    let id = task.get("id").and_then(|v| v.as_str()).ok_or("Missing task ID")?;

    if action == "delete" {
        collection.update_one(doc! { "id": id }, doc! { "$set": { "is_deleted": 1, "updated_at": mongodb::bson::DateTime::now() } }, None)
            .await.map_err(|e| e.to_string())?;
    } else {
        let mut bson_task = match bson::to_bson(&task).map_err(|e| e.to_string())? {
            Bson::Document(d) => d,
            _ => return Err("Invalid task data".to_string()),
        };
        bson_task.insert("updated_at", mongodb::bson::DateTime::now());
        
        let options = mongodb::options::UpdateOptions::builder().upsert(true).build();
        collection.update_one(doc! { "id": id }, doc! { "$set": bson_task }, options)
            .await.map_err(|e| e.to_string())?;
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn notify_task_event(title: String, body: String) {
    println!("Task Event: {} - {}", title, body);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env from root
    dotenv().ok();
    let mongo_uri = env::var("MONGODB_URI").unwrap_or_else(|_| 
        "mongodb+srv://reno:renoroy@cluster0.ckc3hul.mongodb.net/?appName=Cluster0".to_string()
    );
    
    let db_state = DbState {
        db: Arc::new(Mutex::new(None)),
    };
    let db_arc = db_state.db.clone();

    tauri::Builder::default()
        .manage(db_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(move |app| {
            // Initialize MongoDB Async
            let db_handle = db_arc.clone();
            tauri::async_runtime::spawn(async move {
                if !mongo_uri.is_empty() {
                    if let Ok(client) = Client::with_uri_str(&mongo_uri).await {
                        let mut db_guard = db_handle.lock().await;
                        *db_guard = Some(client.database("focussync"));
                        println!("Rust: Connected to MongoDB Atlas");
                    }
                }
            });

            // Menu items for the tray
            let quit_i = MenuItem::with_id(app, "quit", "Quit FocusSync", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open Dashboard", true, None::<&str>)?;
            let sync_i = MenuItem::with_id(app, "sync", "Force Cloud Sync", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &sync_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "sync" => {
                        let _ = app.emit("sync-trigger", ());
                    }
                    _ => {}
                })
                .icon(app.default_window_icon().unwrap().clone())
                .build(app)?;

            // Prevent app from exiting when window is closed (Background Mode)
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            notify_task_event,
            cloud_sync_get,
            cloud_sync_post,
            cloud_get_active_sessions,
            cloud_manage_users,
            cloud_get_proctoring_alerts,
            cloud_manage_tasks
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


