#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

mod browser;

fn main() { browser::run(); }
