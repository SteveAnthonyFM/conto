fn main() {
    // On Windows, everything we build (app and test executables alike) gets one shared manifest
    // requesting Common Controls v6. Without it, `cargo test` binaries fail to start
    // (STATUS_ENTRYPOINT_NOT_FOUND). Tauri's own manifest is turned off so the two don't clash.
    let attrs = if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        let dir = std::env::var("CARGO_MANIFEST_DIR").expect("manifest dir");
        println!("cargo:rerun-if-changed=windows.manifest");
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{dir}/windows.manifest");
        tauri_build::WindowsAttributes::new_without_app_manifest()
    } else {
        tauri_build::WindowsAttributes::new()
    };
    // Declaring the app's commands makes them permission-gated like plugin commands: only windows
    // whose capability grants `allow-<command>` (just `main`, see capabilities/default.json) can call them.
    let app = tauri_build::AppManifest::new().commands(&[
        "refresh_usage",
        "sign_in",
        "sign_out",
        "get_snapshots",
        "get_local_usage",
        "get_settings",
        "set_always_on_top",
        "update_settings",
        "get_autostart",
        "set_autostart",
        "check_for_updates",
        "open_release_page",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(attrs).app_manifest(app)).expect("failed to run tauri-build")
}
