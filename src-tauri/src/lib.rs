use tauri::Manager;
use tauri::Emitter;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;

#[tauri::command]
fn notify_task_event(title: String, body: String) {
    println!("Task Event: {} - {}", title, body);
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
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
        .invoke_handler(tauri::generate_handler![greet, notify_task_event])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
