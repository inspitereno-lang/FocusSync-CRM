const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://reno:renoroy@cluster0.ckc3hul.mongodb.net/?appName=Cluster0";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("focussync");
    
    console.log("Cleaning up FocusSync database...");
    
    const collections = ["sessions", "proctoring_events", "activity_logs"];
    for (const coll of collections) {
      const result = await db.collection(coll).deleteMany({});
      console.log(`Deleted ${result.deletedCount} documents from ${coll}`);
    }
    
    console.log("Database cleanup complete.");
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

main();
