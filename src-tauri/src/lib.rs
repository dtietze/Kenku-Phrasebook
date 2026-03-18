use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

mod db;

pub struct AppDb(pub Mutex<Connection>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()
                .expect("could not resolve app data directory");

            std::fs::create_dir_all(&data_dir)
                .expect("could not create app data directory");

            let db_path = data_dir.join("kenku.db");
            let conn = Connection::open(&db_path)
                .expect("could not open database");

            conn.execute_batch("PRAGMA foreign_keys = ON;")
                .expect("could not enable foreign keys");

            db::migrations::run(&conn)
                .expect("could not run migrations");

            app.manage(AppDb(Mutex::new(conn)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
