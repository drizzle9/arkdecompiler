// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
use tauri::Manager;

use std::{
    backtrace::Backtrace,
    fs::{create_dir_all, OpenOptions},
    io::Write,
};

fn write_startup_log(content: &str) {
    let mut log_dir = std::env::temp_dir();
    log_dir.push("decompiler-gui");
    let _ = create_dir_all(&log_dir);

    let mut log_file = log_dir;
    log_file.push("startup.log");

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_file) {
        let _ = writeln!(file, "{content}");
    }
}

fn main() {
    std::panic::set_hook(Box::new(|panic_info| {
        let bt = Backtrace::force_capture();
        write_startup_log(&format!("[PANIC] {panic_info}\n{bt}\n"));
    }));

    let run_result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // File operation commands
            commands::open_file,
            commands::close_file,
            // Analysis commands
            commands::analyze_file,
            commands::get_functions,
            commands::get_symbols,
            commands::get_strings,
            // Decompile commands
            commands::decompile_function,
            commands::disassemble,
            commands::run_disassemble_tool,
            commands::run_decompile_tool,
            commands::get_tool_config,
            commands::save_tool_config,
            commands::append_output_log,
            commands::read_output_logs,
            commands::clear_output_logs,
            commands::pick_abc_file,
            commands::read_bytes,
            commands::read_file_bytes,
            // Cross reference commands
            commands::get_xrefs,
            // Search commands
            commands::search,
            // Edit commands
            commands::rename_symbol,
            commands::add_comment,
            commands::show_main_window,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(err) = run_result {
        write_startup_log(&format!("[RUN_ERROR] {err:?}"));
    }
}