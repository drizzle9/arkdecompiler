fn main() {
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let mut target_dir = std::path::PathBuf::from(manifest_dir);
        // src-tauri -> project root
        let _ = target_dir.pop();
        target_dir.push("target");
        target_dir.push("tauri");
        std::env::set_var("CARGO_BUILD_TARGET_DIR", target_dir);
    }

    tauri_build::build()
}