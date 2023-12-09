use std::time::{SystemTime, UNIX_EPOCH};
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=../frontend");
    println!("cargo:rerun-if-changed=../frontend/out");
    println!("cargo:warning=build.rs: {:?}", SystemTime::now().duration_since(UNIX_EPOCH) );
    println!("cargo:warning=running build.rs");
    // if pnpm command isnt installed, install it
    if !Command::new("pnpm").arg("--version").output().is_ok() {
        println!("cargo:warning=installing pnpm");
        Command::new("npm")
            .arg("install")
            .arg("-g")
            .arg("pnpm")
            .output()
            .expect("failed to npm install -g pnpm");
    }

    if !std::path::Path::new("../frontend/out").try_exists().unwrap_or(false) {
        println!("cargo:warning=running pnpm build in ../frontend");
        let output = Command::new("pnpm")
            .arg("build")
            .current_dir("../frontend")
            .output()
            .expect("failed to pnpm build in ../frontend");
        println!("cargo:warning=running pnpm build in ../frontend ok");
        println!("{}", String::from_utf8(output.stdout).unwrap());
    } else {
        println!("cargo:warning=../frontend/out already exists");
    }
}
