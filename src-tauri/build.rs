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
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(attrs)).expect("failed to run tauri-build")
}
