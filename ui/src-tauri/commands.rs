//! Decompiler Engine Command Interface
//!
//! These commands are called from the frontend to interact with the decompiler engine.
//! The actual engine logic will be implemented here or integrated as an external library.

use serde::{Deserialize, Serialize};
use std::{
    env,
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

// ============ Data Structure Definitions ============

/// Binary file information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryFileInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub format: String,
    pub architecture: String,
    pub entry_point: u64,
    pub base_address: u64,
}

/// Function information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionInfo {
    pub id: String,
    pub name: String,
    pub address: u64,
    pub size: u64,
    pub return_type: String,
    pub parameters: Vec<ParameterInfo>,
    pub is_library: bool,
}

/// Parameter information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterInfo {
    pub name: String,
    pub type_name: String,
    pub offset: Option<u32>,
    pub register: Option<String>,
}

/// Symbol information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolInfo {
    pub id: String,
    pub name: String,
    pub address: u64,
    pub size: u64,
    pub symbol_type: String,
    pub binding: String,
}

/// Search options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub use_regex: bool,
    pub scopes: Vec<String>,
}

/// Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub result_type: String,
    pub name: String,
    pub address: u64,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlatformPaths {
    #[serde(default)]
    win32: String,
    #[serde(default)]
    linux: String,
    #[serde(default)]
    darwin: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolConfigFile {
    #[serde(default, rename = "arkDisasm")]
    ark_disasm: PlatformPaths,
    #[serde(default, rename = "arkDecompile")]
    ark_decompile: PlatformPaths,
    #[serde(default, rename = "workspaceRoot")]
    workspace_root: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolConfigResponse {
    #[serde(rename = "arkDisasm")]
    pub ark_disasm: PlatformPaths,
    #[serde(rename = "arkDecompile")]
    pub ark_decompile: PlatformPaths,
    #[serde(rename = "workspaceRoot")]
    pub workspace_root: String,
    #[serde(rename = "configPath")]
    pub config_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolRunResponse {
    pub success: bool,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub output: String,
    pub output_bytes: u64,
    pub output_truncated: bool,
    pub output_file_path: String,
    pub work_dir: String,
    pub command_path: String,
    pub config_path: String,
    pub searched_config_paths: Vec<String>,
    pub tried_command_sources: Vec<String>,
    pub command_stdout: String,
    pub command_stderr: String,
}

#[derive(Debug, Clone)]
struct ToolExecutionResult {
    output_preview: String,
    output_bytes: u64,
    output_truncated: bool,
    command_stdout: String,
    command_stderr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeOutputLogEntry {
    pub id: String,
    pub r#type: String,
    pub message: String,
    pub details: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadOutputLogsRequest {
    pub start: Option<usize>,
    pub limit: Option<usize>,
    pub filter: Option<String>,
    pub from_tail: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadOutputLogsResponse {
    pub total: usize,
    pub start: usize,
    pub entries: Vec<RuntimeOutputLogEntry>,
}

#[derive(Clone, Copy)]
struct ToolDefinition {
    config_key: &'static str,
    env_key: &'static str,
    display_name: &'static str,
    action_name: &'static str,
    output_ext: &'static str,
    win_binary_names: &'static [&'static str],
    other_binary_names: &'static [&'static str],
}

const TOOL_CONFIG_FILE: &str = "tools.json";
const LEGACY_TOOL_CONFIG_FILE: &str = "engine-tools.config.json";
const LEGACY_BROKEN_TOOL_CONFIG_FILE: &str = "engine-tools.-config.json";
const TOOL_CONFIG_FILE_CANDIDATES: [&str; 3] = [
    TOOL_CONFIG_FILE,
    LEGACY_TOOL_CONFIG_FILE,
    LEGACY_BROKEN_TOOL_CONFIG_FILE,
];

const DISASM_TOOL_DEFINITION: ToolDefinition = ToolDefinition {
    config_key: "arkDisasm",
    env_key: "ARK_DISASM_COMMAND",
    display_name: "ark_disasm",
    action_name: "Disassembly",
    output_ext: ".pa",
    win_binary_names: &["ark_disasm.exe", "ark_disasm"],
    other_binary_names: &["ark_disasm"],
};

const DECOMPILE_TOOL_DEFINITION: ToolDefinition = ToolDefinition {
    config_key: "arkDecompile",
    env_key: "ARK_DECOMPILE_COMMAND",
    display_name: "ark_decompile",
    action_name: "Decompile",
    output_ext: ".decompile.txt",
    win_binary_names: &[
        "ark_decompile.exe",
        "ark_decompile",
        "ark_decompiler.exe",
        "ark_decompiler",
    ],
    other_binary_names: &["ark_decompile", "ark_decompiler"],
};

const OUTPUT_LOG_FILE: &str = "output-logs.jsonl";
const MAX_OUTPUT_LOG_READ_LINES: usize = 50_000;

fn get_tool_definition(tool_kind: &str) -> Result<&'static ToolDefinition, String> {
    match tool_kind {
        "disasm" => Ok(&DISASM_TOOL_DEFINITION),
        "decompile" => Ok(&DECOMPILE_TOOL_DEFINITION),
        _ => Err(format!("Unknown tool type: {tool_kind}")),
    }
}

fn get_platform_key() -> &'static str {
    if cfg!(target_os = "windows") {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    }
}

fn get_tool_binary_names(definition: &ToolDefinition) -> &'static [&'static str] {
    if cfg!(target_os = "windows") {
        definition.win_binary_names
    } else {
        definition.other_binary_names
    }
}

fn default_config_path() -> PathBuf {
    if let Ok(user_profile) = env::var("USERPROFILE") {
        return PathBuf::from(user_profile)
            .join("Documents")
            .join("arkdecompiler")
            .join(TOOL_CONFIG_FILE);
    }

    if let Ok(home) = env::var("HOME") {
        return PathBuf::from(home)
            .join("Documents")
            .join("arkdecompiler")
            .join(TOOL_CONFIG_FILE);
    }

    PathBuf::from(TOOL_CONFIG_FILE)
}

fn empty_tool_config() -> ToolConfigFile {
    ToolConfigFile::default()
}

fn normalize_platform_paths(paths: PlatformPaths) -> PlatformPaths {
    PlatformPaths {
        win32: paths.win32.trim().to_string(),
        linux: paths.linux.trim().to_string(),
        darwin: paths.darwin.trim().to_string(),
    }
}

fn normalize_tool_config(input: ToolConfigFile) -> ToolConfigFile {
    ToolConfigFile {
        ark_disasm: normalize_platform_paths(input.ark_disasm),
        ark_decompile: normalize_platform_paths(input.ark_decompile),
        workspace_root: input.workspace_root.trim().to_string(),
    }
}

fn choose_value(user_value: &str, default_value: &str) -> String {
    let user_trimmed = user_value.trim();
    if !user_trimmed.is_empty() {
        return user_trimmed.to_string();
    }
    default_value.trim().to_string()
}

fn merge_with_defaults(user: ToolConfigFile, defaults: ToolConfigFile) -> ToolConfigFile {
    let user = normalize_tool_config(user);
    let defaults = normalize_tool_config(defaults);

    ToolConfigFile {
        ark_disasm: PlatformPaths {
            win32: choose_value(&user.ark_disasm.win32, &defaults.ark_disasm.win32),
            linux: choose_value(&user.ark_disasm.linux, &defaults.ark_disasm.linux),
            darwin: choose_value(&user.ark_disasm.darwin, &defaults.ark_disasm.darwin),
        },
        ark_decompile: PlatformPaths {
            win32: choose_value(&user.ark_decompile.win32, &defaults.ark_decompile.win32),
            linux: choose_value(&user.ark_decompile.linux, &defaults.ark_decompile.linux),
            darwin: choose_value(&user.ark_decompile.darwin, &defaults.ark_decompile.darwin),
        },
        workspace_root: if user.workspace_root.trim().is_empty() {
            defaults.workspace_root
        } else {
            user.workspace_root
        },
    }
}

fn get_default_template_config_paths() -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = Vec::new();

    if let Ok(cwd) = env::current_dir() {
        paths.push(cwd.join(TOOL_CONFIG_FILE));
    }

    if let Ok(exe) = env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            paths.push(exe_dir.join(TOOL_CONFIG_FILE));
            paths.push(exe_dir.join("resources").join(TOOL_CONFIG_FILE));
            if let Some(parent) = exe_dir.parent() {
                paths.push(parent.join(TOOL_CONFIG_FILE));
            }
        }
    }

    let mut unique: Vec<PathBuf> = Vec::new();
    for p in paths {
        if !unique.iter().any(|existing| existing == &p) {
            unique.push(p);
        }
    }
    unique
}

fn embedded_default_tool_config() -> ToolConfigFile {
    match serde_json::from_str::<ToolConfigFile>(include_str!("../tools.json")) {
        Ok(v) => normalize_tool_config(v),
        Err(_) => empty_tool_config(),
    }
}

fn load_bundled_default_tool_config() -> ToolConfigFile {
    for candidate in get_default_template_config_paths() {
        let text = match fs::read_to_string(&candidate) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let parsed: ToolConfigFile = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => continue,
        };
        return normalize_tool_config(parsed);
    }
    embedded_default_tool_config()
}

fn ensure_default_tool_config_file(path: &Path) {
    if path.exists() {
        return;
    }

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let default_text = match serde_json::to_string_pretty(&load_bundled_default_tool_config()) {
        Ok(text) => format!("{text}\n"),
        Err(_) => "{\n  \"arkDisasm\": {\n    \"win32\": \"\",\n    \"linux\": \"\",\n    \"darwin\": \"\"\n  },\n  \"arkDecompile\": {\n    \"win32\": \"\",\n    \"linux\": \"\",\n    \"darwin\": \"\"\n  },\n  \"workspaceRoot\": \"\"\n}\n".to_string(),
    };

    let _ = fs::write(path, default_text);
}

fn append_config_candidates(paths: &mut Vec<PathBuf>, base_dir: &Path) {
    for file_name in TOOL_CONFIG_FILE_CANDIDATES {
        paths.push(base_dir.join(file_name));
    }
}

fn get_candidate_config_paths() -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = Vec::new();

    if let Ok(user_profile) = env::var("USERPROFILE") {
        let user_docs_dir = PathBuf::from(user_profile)
            .join("Documents")
            .join("arkdecompiler");
        append_config_candidates(&mut paths, &user_docs_dir);
    }

    if let Ok(home) = env::var("HOME") {
        let home_docs_dir = PathBuf::from(home).join("Documents").join("arkdecompiler");
        append_config_candidates(&mut paths, &home_docs_dir);
    }

    if let Ok(cwd) = env::current_dir() {
        append_config_candidates(&mut paths, &cwd);
    }

    if let Ok(exe) = env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            append_config_candidates(&mut paths, exe_dir);

            let resources_dir = exe_dir.join("resources");
            append_config_candidates(&mut paths, &resources_dir);

            if let Some(parent) = exe_dir.parent() {
                append_config_candidates(&mut paths, parent);
            }
        }
    }

    let mut unique: Vec<PathBuf> = Vec::new();
    for p in paths {
        if !unique.iter().any(|existing| existing == &p) {
            unique.push(p);
        }
    }
    unique
}

fn load_tool_config() -> Result<(ToolConfigFile, PathBuf, Vec<PathBuf>), String> {
    let default_path = default_config_path();
    ensure_default_tool_config_file(&default_path);

    let candidates = get_candidate_config_paths();
    let existing_path = candidates.iter().find(|p| p.exists()).cloned();
    let defaults = load_bundled_default_tool_config();

    if let Some(config_path) = existing_path {
        let text = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config file: {}，{}", config_path.display(), e))?;
        let config: ToolConfigFile = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse config file: {}，{}", config_path.display(), e))?;
        Ok((merge_with_defaults(config, defaults), config_path, candidates))
    } else {
        Ok((defaults, default_path, candidates))
    }
}

fn persist_tool_config(config: &ToolConfigFile, path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}，{}", parent.display(), e))?;
    }
    let text = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config file: {e}"))?;
    fs::write(path, format!("{text}\n"))
        .map_err(|e| format!("Failed to write config file: {}，{}", path.display(), e))
}

fn find_binary_in_directory(directory_path: &Path, binary_names: &[&str]) -> Option<PathBuf> {
    for name in binary_names {
        let direct = directory_path.join(name);
        if direct.exists() {
            return Some(direct);
        }
        let in_bin = directory_path.join("bin").join(name);
        if in_bin.exists() {
            return Some(in_bin);
        }
    }
    None
}

fn unquote_token(token: &str) -> String {
    let t = token.trim();
    if (t.starts_with('"') && t.ends_with('"')) || (t.starts_with('\'') && t.ends_with('\'')) {
        return t[1..t.len().saturating_sub(1)].to_string();
    }
    t.to_string()
}

fn tokenize_command_spec(command_spec: &str) -> Vec<String> {
    let mut tokens: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;

    for ch in command_spec.chars() {
        match quote {
            Some(q) => {
                if ch == q {
                    quote = None;
                } else {
                    current.push(ch);
                }
            }
            None => {
                if ch == '"' || ch == '\'' {
                    quote = Some(ch);
                } else if ch.is_whitespace() {
                    if !current.is_empty() {
                        tokens.push(current.clone());
                        current.clear();
                    }
                } else {
                    current.push(ch);
                }
            }
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
        .into_iter()
        .map(|t| unquote_token(&t))
        .filter(|t| !t.is_empty())
        .collect()
}

#[derive(Debug, Clone)]
struct ParsedCommandSpec {
    executable: String,
    prefix_args: Vec<String>,
    env_vars: Vec<(String, String)>,
}

fn parse_command_spec(command_spec: &str) -> ParsedCommandSpec {
    let tokens = tokenize_command_spec(command_spec);
    let mut env_vars: Vec<(String, String)> = Vec::new();
    let mut cursor = 0usize;

    while cursor < tokens.len() {
        let token = &tokens[cursor];
        if let Some(eq_index) = token.find('=') {
            let key = &token[..eq_index];
            let value = &token[eq_index + 1..];
            let key_valid = !key.is_empty()
                && key
                    .chars()
                    .all(|ch| ch == '_' || ch.is_ascii_alphanumeric())
                && key
                    .chars()
                    .next()
                    .map(|ch| ch == '_' || ch.is_ascii_alphabetic())
                    .unwrap_or(false);
            if key_valid {
                env_vars.push((key.to_string(), value.to_string()));
                cursor += 1;
                continue;
            }
        }
        break;
    }

    let mut executable = tokens.get(cursor).cloned().unwrap_or_default();
    let mut arg_start = cursor.saturating_add(1);

    if cfg!(target_os = "windows") && !executable.is_empty() {
        let looks_like_windows_path = executable.starts_with(r"\\")
            || executable
                .as_bytes()
                .get(1)
                .map(|v| *v == b':')
                .unwrap_or(false)
            || executable.contains('\\')
            || executable.contains('/');

        if looks_like_windows_path && !Path::new(&executable).exists() {
            for end in ((cursor + 1)..=tokens.len()).rev() {
                let candidate = tokens[cursor..end].join(" ");
                if Path::new(&candidate).exists() {
                    executable = candidate;
                    arg_start = end;
                    break;
                }
            }
        }
    }

    let prefix_args = if arg_start < tokens.len() {
        tokens[arg_start..].to_vec()
    } else {
        Vec::new()
    };

    ParsedCommandSpec {
        executable,
        prefix_args,
        env_vars,
    }
}

fn normalize_command_path(raw_path: &str, binary_names: &[&str]) -> String {
    let candidate = raw_path.trim();
    if candidate.is_empty() {
        return String::new();
    }

    let parsed = parse_command_spec(candidate);
    if parsed.executable.is_empty() {
        return String::new();
    }

    let exe_candidate = PathBuf::from(&parsed.executable);
    if exe_candidate.is_dir() {
        if let Some(found) = find_binary_in_directory(&exe_candidate, binary_names) {
            let replaced = found.to_string_lossy().to_string();
            let mut merged_tokens: Vec<String> = parsed
                .env_vars
                .into_iter()
                .map(|(k, v)| format!("{k}={v}"))
                .collect();
            merged_tokens.push(replaced);
            merged_tokens.extend(parsed.prefix_args);
            return merged_tokens.join(" ");
        }
        return String::new();
    }

    candidate.to_string()
}

fn get_configured_tool_path(config: &ToolConfigFile, config_key: &str, platform_key: &str) -> String {
    let paths = match config_key {
        "arkDisasm" => &config.ark_disasm,
        "arkDecompile" => &config.ark_decompile,
        _ => return String::new(),
    };

    match platform_key {
        "win32" => paths.win32.trim().to_string(),
        "darwin" => paths.darwin.trim().to_string(),
        _ => paths.linux.trim().to_string(),
    }
}

fn resolve_tool_command_path(
    definition: &ToolDefinition,
    binary_path: Option<String>,
    config: &ToolConfigFile,
    config_path: &Path,
    searched_paths: &[PathBuf],
) -> Result<(String, Vec<String>), String> {
    let mut tried: Vec<String> = Vec::new();
    let binary_names = get_tool_binary_names(definition);

    if let Some(payload_path) = binary_path {
        let normalized = normalize_command_path(&payload_path, binary_names);
        if !normalized.is_empty() {
            return Ok((normalized, tried));
        }
    }

    let platform_key = get_platform_key();
    let raw_from_config = get_configured_tool_path(config, definition.config_key, platform_key);
    if !raw_from_config.is_empty() {
        tried.push(format!("config({platform_key}): {raw_from_config}"));
        let normalized = normalize_command_path(&raw_from_config, binary_names);
        if !normalized.is_empty() {
            return Ok((normalized, tried));
        }
    }

    let env_value = env::var(definition.env_key).unwrap_or_default().trim().to_string();
    if !env_value.is_empty() {
        tried.push(format!("env({}): {}", definition.env_key, env_value));
        let normalized = normalize_command_path(&env_value, binary_names);
        if !normalized.is_empty() {
            return Ok((normalized, tried));
        }
    }

    let searched = if searched_paths.is_empty() {
        "-".to_string()
    } else {
        searched_paths
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(" | ")
    };

    Err(format!(
        "{} not found, please check the following locations.\nTried config paths: {}\nTried command sources: {}\nPlease set {}.{} in {}",
        definition.display_name,
        searched,
        if tried.is_empty() { "(none)".to_string() } else { tried.join(" | ") },
        definition.config_key,
        platform_key,
        config_path.display()
    ))
}

fn assert_command_path(command_spec: &str, display_name: &str) -> Result<(), String> {
    let command = command_spec.trim();
    if command.is_empty() {
        return Err(format!("{display_name} path not configured"));
    }

    let parsed = parse_command_spec(command);
    let executable = parsed.executable.trim();
    if executable.is_empty() {
        return Err(format!("Failed to parse {display_name} executable path: {command_spec}"));
    }

    let is_path_like =
        executable.contains('\\') || executable.contains('/') || Path::new(executable).is_absolute();
    if is_path_like {
        if !Path::new(executable).exists() {
            return Err(format!("{display_name} tool does not exist: {executable}"));
        }
        return Ok(());
    }

    let path_env = env::var_os("PATH").unwrap_or_default();
    let entries: Vec<PathBuf> = env::split_paths(&path_env).collect();
    let mut names: Vec<String> = vec![executable.to_string()];
    if cfg!(target_os = "windows") && !executable.to_lowercase().ends_with(".exe") {
        names.push(format!("{executable}.exe"));
    }

    for entry in entries {
        for name in &names {
            let full = entry.join(name);
            if full.exists() {
                return Ok(());
            }
        }
    }

    Err(format!(
        "Executable ({display_name}) not found in system PATH: {executable}"
    ))
}

fn project_root_directory() -> PathBuf {
    if let Ok(cwd) = env::current_dir() {
        return cwd;
    }

    if let Some(manifest_dir) = option_env!("CARGO_MANIFEST_DIR") {
        let manifest_path = PathBuf::from(manifest_dir);
        if let Some(parent) = manifest_path.parent() {
            return parent.to_path_buf();
        }
        return manifest_path;
    }

    PathBuf::from(".")
}

fn target_tauri_workspace_root() -> PathBuf {
    project_root_directory()
        .join("target")
        .join("tauri")
        .join("work")
}

fn path_contains_component_case_insensitive(path: &Path, target: &str) -> bool {
    path.components().any(|component| {
        component
            .as_os_str()
            .to_string_lossy()
            .eq_ignore_ascii_case(target)
    })
}

fn create_work_directory(input_file_path: &Path, config: &ToolConfigFile) -> Result<PathBuf, String> {
    let configured_root = config.workspace_root.trim();

    let mut workspace_root = if configured_root.is_empty() {
        // Default: .arkdecompiler-work/ next to the abc file.
        input_file_path
            .parent()
            .map(|parent| parent.join(".arkdecompiler-work"))
            .unwrap_or_else(target_tauri_workspace_root)
    } else {
        let configured = PathBuf::from(configured_root);
        if configured.is_absolute() {
            configured
        } else {
            project_root_directory().join(configured)
        }
    };

    if path_contains_component_case_insensitive(&workspace_root, "src-tauri") {
        workspace_root = target_tauri_workspace_root();
    }

    if let Err(error) = fs::create_dir_all(&workspace_root) {
        if configured_root.is_empty() {
            workspace_root = target_tauri_workspace_root();
            fs::create_dir_all(&workspace_root).map_err(|fallback_error| {
                format!(
                    "Failed to create workspace directory: {}，{fallback_error} (original: {}，{error})",
                    workspace_root.display(),
                    input_file_path.display()
                )
            })?;
        } else {
            return Err(format!(
                "Failed to create configured workspace directory: {}，{}",
                workspace_root.display(),
                error
            ));
        }
    }

    let file_base = input_file_path
        .file_stem()
        .and_then(|v| v.to_str())
        .unwrap_or("input");
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("System time error: {e}"))?
        .as_millis();
    let work_dir = workspace_root.join(format!("{file_base}-{ts}"));

    fs::create_dir_all(&work_dir)
        .map_err(|e| format!("Failed to create task directory: {}，{}", work_dir.display(), e))?;

    Ok(work_dir)
}

fn read_output_preview(output_file_path: &Path) -> Result<(String, u64), String> {
    let text = fs::read_to_string(output_file_path)
        .map_err(|e| format!("Failed to read output file: {}，{}", output_file_path.display(), e))?;
    let bytes = text.as_bytes().len() as u64;
    Ok((text, bytes))
}

fn run_tool_with_output_file(
    command_spec: &str,
    input_file_path: &Path,
    output_file_path: &Path,
    action_name: &str,
) -> Result<ToolExecutionResult, String> {
    let parsed = parse_command_spec(command_spec);
    if parsed.executable.trim().is_empty() {
        return Err(format!("{action_name} command has no executable path: {command_spec}"));
    }

    let mut command = Command::new(&parsed.executable);
    for (k, v) in parsed.env_vars {
        command.env(k, v);
    }
    for arg in parsed.prefix_args {
        command.arg(arg);
    }
    let output = command
        .arg(input_file_path)
        .arg(output_file_path)
        .output()
        .map_err(|e| format!("{action_name} command execution failed: {e}\ncommand: {command_spec}"))?;

    let stdout_text = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr_text = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let message = if !stderr_text.trim().is_empty() {
            stderr_text.trim().to_string()
        } else if !stdout_text.trim().is_empty() {
            stdout_text.trim().to_string()
        } else {
            format!("{action_name} command execution failed")
        };

        let details = [
            message,
            format!("command: {command_spec}"),
            if stdout_text.trim().is_empty() {
                String::new()
            } else {
                format!("stdout:\n{stdout_text}")
            },
            if stderr_text.trim().is_empty() {
                String::new()
            } else {
                format!("stderr:\n{stderr_text}")
            },
        ]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

        return Err(details);
    }

    if output_file_path.exists() {
        let (preview, bytes) = read_output_preview(output_file_path)?;
        return Ok(ToolExecutionResult {
            output_preview: preview,
            output_bytes: bytes,
            output_truncated: false,
            command_stdout: stdout_text,
            command_stderr: stderr_text,
        });
    }

    if !stdout_text.trim().is_empty() {
        return Ok(ToolExecutionResult {
            output_preview: stdout_text.clone(),
            output_bytes: stdout_text.as_bytes().len() as u64,
            output_truncated: false,
            command_stdout: stdout_text,
            command_stderr: stderr_text,
        });
    }

    Err(format!(
        "{action_name} output file does not exist: {}",
        output_file_path.display()
    ))
}

fn run_external_tool(
    tool_kind: &str,
    file_path: String,
    binary_path: Option<String>,
) -> Result<ToolRunResponse, String> {
    if !file_path.to_lowercase().ends_with(".abc") {
        return Err("Only .abc files are supported".to_string());
    }

    let input_file = PathBuf::from(&file_path);
    if !input_file.exists() {
        return Err("File does not exist".to_string());
    }

    let definition = get_tool_definition(tool_kind)?;
    let (config, config_path, searched_paths) = load_tool_config()?;
    let (command_path, tried) =
        resolve_tool_command_path(definition, binary_path, &config, &config_path, &searched_paths)?;
    assert_command_path(&command_path, definition.display_name)?;

    let work_dir = create_work_directory(&input_file, &config)?;
    let staged_input_path = work_dir.join(
        input_file
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("input.abc"),
    );
    fs::copy(&input_file, &staged_input_path)
        .map_err(|e| format!("Failed to copy input file: {}，{}", staged_input_path.display(), e))?;

    let output_file_path = work_dir.join(format!(
        "{}{}",
        input_file
            .file_stem()
            .and_then(|v| v.to_str())
            .unwrap_or("output"),
        definition.output_ext
    ));

    let tool_result = run_tool_with_output_file(
        &command_path,
        &staged_input_path,
        &output_file_path,
        definition.action_name,
    )?;

    let metadata = fs::metadata(&input_file).map_err(|e| format!("Failed to read file info: {e}"))?;

    Ok(ToolRunResponse {
        success: true,
        file_path: file_path.clone(),
        file_name: input_file
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("unknown.abc")
            .to_string(),
        file_size: metadata.len(),
        output: tool_result.output_preview,
        output_bytes: tool_result.output_bytes,
        output_truncated: tool_result.output_truncated,
        output_file_path: output_file_path.to_string_lossy().to_string(),
        work_dir: work_dir.to_string_lossy().to_string(),
        command_path,
        config_path: config_path.to_string_lossy().to_string(),
        searched_config_paths: searched_paths
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect(),
        tried_command_sources: tried,
        command_stdout: tool_result.command_stdout,
        command_stderr: tool_result.command_stderr,
    })
}

#[tauri::command]
pub async fn run_disassemble_tool(
    file_path: String,
    binary_path: Option<String>,
) -> Result<ToolRunResponse, String> {
    run_external_tool("disasm", file_path, binary_path)
}

#[tauri::command]
pub async fn run_decompile_tool(
    file_path: String,
    binary_path: Option<String>,
) -> Result<ToolRunResponse, String> {
    run_external_tool("decompile", file_path, binary_path)
}

#[tauri::command]
pub async fn get_tool_config() -> Result<ToolConfigResponse, String> {
    let (config, config_path, _) = load_tool_config()?;
    Ok(ToolConfigResponse {
        ark_disasm: config.ark_disasm,
        ark_decompile: config.ark_decompile,
        workspace_root: config.workspace_root,
        config_path: config_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn save_tool_config(config: ToolConfigFile) -> Result<ToolConfigResponse, String> {
    let normalized = normalize_tool_config(config);
    let (_, config_path, _) = load_tool_config()?;
    persist_tool_config(&normalized, &config_path)?;

    Ok(ToolConfigResponse {
        ark_disasm: normalized.ark_disasm,
        ark_decompile: normalized.ark_decompile,
        workspace_root: normalized.workspace_root,
        config_path: config_path.to_string_lossy().to_string(),
    })
}

fn output_log_file_path() -> Result<PathBuf, String> {
    let mut dir = env::temp_dir();
    dir.push("decompiler-gui");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create log dir: {e}"))?;
    dir.push(OUTPUT_LOG_FILE);
    Ok(dir)
}

fn ensure_output_log_file() -> Result<PathBuf, String> {
    let file_path = output_log_file_path()?;
    if !file_path.exists() {
        fs::write(&file_path, "").map_err(|e| format!("Failed to init output log file: {e}"))?;
    }
    Ok(file_path)
}

fn normalize_output_log_entry(mut entry: RuntimeOutputLogEntry) -> RuntimeOutputLogEntry {
    if entry.id.trim().is_empty() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|v| v.as_millis())
            .unwrap_or(0);
        entry.id = format!("log-{now}");
    }

    let normalized_type = match entry.r#type.as_str() {
        "info" | "success" | "warning" | "error" => entry.r#type.clone(),
        _ => "info".to_string(),
    };
    entry.r#type = normalized_type;

    if entry.timestamp.trim().is_empty() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|v| v.as_millis())
            .unwrap_or(0);
        entry.timestamp = format!("{now}");
    }

    entry
}

fn read_output_log_entries(filter: &str) -> Result<Vec<RuntimeOutputLogEntry>, String> {
    let file_path = ensure_output_log_file()?;
    let lines = read_last_jsonl_lines(&file_path, MAX_OUTPUT_LOG_READ_LINES)?;
    if lines.is_empty() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for line in lines {
        if let Ok(parsed) = serde_json::from_str::<RuntimeOutputLogEntry>(&line) {
            let item = normalize_output_log_entry(parsed);
            if filter != "all" && item.r#type != filter {
                continue;
            }
            entries.push(item);
        }
    }

    Ok(entries)
}

fn read_last_jsonl_lines(file_path: &Path, max_lines: usize) -> Result<Vec<String>, String> {
    use std::fs::File;
    use std::io::{Read, Seek, SeekFrom};

    if max_lines == 0 {
        return Ok(Vec::new());
    }

    let mut file =
        File::open(file_path).map_err(|e| format!("Failed to open output logs file: {e}"))?;
    let file_size = file
        .metadata()
        .map_err(|e| format!("Failed to stat output logs file: {e}"))?
        .len();
    if file_size == 0 {
        return Ok(Vec::new());
    }

    const CHUNK_SIZE: u64 = 64 * 1024;
    let mut position = file_size;
    let mut carry = String::new();
    let mut lines: Vec<String> = Vec::new();

    while position > 0 && lines.len() < max_lines {
        let read_size = CHUNK_SIZE.min(position) as usize;
        position -= read_size as u64;
        file.seek(SeekFrom::Start(position))
            .map_err(|e| format!("Failed to seek output logs file: {e}"))?;

        let mut buf = vec![0u8; read_size];
        file.read_exact(&mut buf)
            .map_err(|e| format!("Failed to read output logs chunk: {e}"))?;

        let chunk_text = String::from_utf8_lossy(&buf).to_string();
        let merged = format!("{chunk_text}{carry}");
        let mut parts: Vec<&str> = merged.lines().collect();
        carry = if merged.ends_with('\n') {
            String::new()
        } else {
            parts.first().map(|s| s.to_string()).unwrap_or_default()
        };
        if !merged.ends_with('\n') && !parts.is_empty() {
            let _ = parts.remove(0);
        }

        for part in parts.into_iter().rev() {
            let line = part.trim();
            if line.is_empty() {
                continue;
            }
            lines.push(line.to_string());
            if lines.len() >= max_lines {
                break;
            }
        }
    }

    let tail = carry.trim();
    if !tail.is_empty() && lines.len() < max_lines {
        lines.push(tail.to_string());
    }

    lines.reverse();
    Ok(lines)
}

#[tauri::command]
pub async fn append_output_log(entry: RuntimeOutputLogEntry) -> Result<(), String> {
    let file_path = ensure_output_log_file()?;
    let normalized = normalize_output_log_entry(entry);
    let line = serde_json::to_string(&normalized)
        .map_err(|e| format!("Failed to serialize output log entry: {e}"))?;
    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("Failed to open output log file: {e}"))?;
    file.write_all(format!("{line}\n").as_bytes())
        .map_err(|e| format!("Failed to append output log entry: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn read_output_logs(payload: ReadOutputLogsRequest) -> Result<ReadOutputLogsResponse, String> {
    let filter = payload
        .filter
        .as_deref()
        .map(|v| match v {
            "info" | "success" | "warning" | "error" | "all" => v,
            _ => "all",
        })
        .unwrap_or("all");
    let entries = read_output_log_entries(filter)?;
    let total = entries.len();
    let limit = payload.limit.unwrap_or(120).clamp(1, 500);
    let start = if payload.from_tail.unwrap_or(false) {
        total.saturating_sub(limit)
    } else {
        payload.start.unwrap_or(0).min(total)
    };
    let end = (start + limit).min(total);
    let page = entries[start..end].to_vec();

    Ok(ReadOutputLogsResponse {
        total,
        start,
        entries: page,
    })
}

#[tauri::command]
pub async fn clear_output_logs() -> Result<(), String> {
    let file_path = ensure_output_log_file()?;
    fs::write(file_path, "").map_err(|e| format!("Failed to clear output logs: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn pick_abc_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let selected = app
        .dialog()
        .file()
        .set_title("Select .abc file")
        .add_filter("ABC Files", &["abc"])
        .blocking_pick_file();

    match selected {
        Some(file_path) => {
            let path = file_path
                .into_path()
                .map_err(|e| format!("Failed to resolve selected file path: {e}"))?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

// ============ Tauri Commands ============

/// Open file
#[tauri::command]
pub async fn open_file(_path: String) -> Result<BinaryFileInfo, String> {
    // TODO: Implement file open logic
    // Steps:
    // 1. Check if file exists
    // 2. Read file header info
    // 3. Parse file format (PE/ELF/Mach-O/DEX, etc.)
    // 4. Extract basic info (architecture, entry point, etc.)
    // 5. Return file info
    
    Err("Engine not implemented - open_file".to_string())
}

/// Close file
#[tauri::command]
pub async fn close_file(file_id: String) -> Result<(), String> {
    // TODO: Implement file close logic
    // Steps:
    // 1. Unload file from memory
    // 2. Clean up related caches
    // 3. Release resources
    
    let _ = file_id;
    Err("Engine not implemented - close_file".to_string())
}

/// Perform full analysis
#[tauri::command]
pub async fn analyze_file(file_id: String) -> Result<(), String> {
    // TODO: Implement file analysis logic
    // Steps:
    // 1. Identify entry points
    // 2. Build control flow graph (CFG)
    // 3. Identify function boundaries
    // 4. Parse symbol table
    // 5. Identify strings
    // 6. Analyze cross references
    // 7. Type inference
    
    let _ = file_id;
    Err("Engine not implemented - analyze_file".to_string())
}

/// Get function list
#[tauri::command]
pub async fn get_functions(file_id: String) -> Result<Vec<FunctionInfo>, String> {
    // TODO: Implement get function list logic
    
    let _ = file_id;
    Err("Engine not implemented - get_functions".to_string())
}

/// Get symbol list
#[tauri::command]
pub async fn get_symbols(file_id: String) -> Result<Vec<SymbolInfo>, String> {
    // TODO: Implement get symbol list logic
    
    let _ = file_id;
    Err("Engine not implemented - get_symbols".to_string())
}

/// Decompile function
#[tauri::command]
pub async fn decompile_function(file_id: String, address: u64) -> Result<String, String> {
    // TODO: Implement function decompile logic
    // Steps:
    // 1. Locate function
    // 2. Get control flow graph
    // 3. Lift to intermediate representation (IR)
    // 4. Perform data flow analysis
    // 5. Type inference
    // 6. Generate high-level language code
    
    let _ = (file_id, address);
    Err("Engine not implemented - decompile_function".to_string())
}

/// Disassemble instructions
#[tauri::command]
pub async fn disassemble(file_id: String, address: u64, count: u32) -> Result<Vec<String>, String> {
    // TODO: Implement disassembly logic
    
    let _ = (file_id, address, count);
    Err("Engine not implemented - disassemble".to_string())
}

/// Read memory data (from loaded file)
#[tauri::command]
pub async fn read_bytes(file_id: String, address: u64, size: u32) -> Result<Vec<u8>, String> {
    let _ = (file_id, address, size);
    Err("Engine not implemented - read_bytes".to_string())
}

/// Read file bytes directly from file path
/// This command reads raw bytes from the file at the specified offset and size
#[tauri::command]
pub async fn read_file_bytes(file_path: String, offset: u64, size: u32) -> Result<Vec<u8>, String> {
    use std::fs::File;
    use std::io::{Read, Seek, SeekFrom};
    
    // Validate inputs
    if size == 0 {
        return Ok(Vec::new());
    }
    
    // Limit max read size to 1MB for safety
    const MAX_READ_SIZE: u32 = 1024 * 1024;
    let read_size = size.min(MAX_READ_SIZE);
    
    // Open file
    let mut file = File::open(&file_path)
        .map_err(|e| format!("Failed to open file '{}': {}", file_path, e))?;
    
    // Get file size
    let file_size = file.metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();
    
    // Validate offset
    if offset >= file_size {
        return Ok(Vec::new());
    }
    
    // Seek to offset
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| format!("Failed to seek to offset {}: {}", offset, e))?;
    
    // Calculate actual read size (don't read past end of file)
    let remaining = file_size - offset;
    let actual_size = (read_size as u64).min(remaining) as usize;
    
    // Read bytes
    let mut buffer = vec![0u8; actual_size];
    file.read_exact(&mut buffer)
        .map_err(|e| format!("Failed to read {} bytes at offset {}: {}", actual_size, offset, e))?;
    
    Ok(buffer)
}

/// Get cross references
#[tauri::command]
pub async fn get_xrefs(file_id: String, address: u64) -> Result<Vec<(u64, String)>, String> {
    // TODO: Implement cross reference query logic
    
    let _ = (file_id, address);
    Err("Engine not implemented - get_xrefs".to_string())
}

/// Search
#[tauri::command]
pub async fn search(file_id: String, query: SearchQuery) -> Result<Vec<SearchResult>, String> {
    // TODO: Implement search logic
    
    let _ = (file_id, query);
    Err("Engine not implemented - search".to_string())
}

/// Rename symbol
#[tauri::command]
pub async fn rename_symbol(file_id: String, symbol_id: String, new_name: String) -> Result<(), String> {
    // TODO: Implement symbol rename logic
    
    let _ = (file_id, symbol_id, new_name);
    Err("Engine not implemented - rename_symbol".to_string())
}

/// Add comment
#[tauri::command]
pub async fn add_comment(file_id: String, address: u64, text: String) -> Result<String, String> {
    // TODO: Implement add comment logic
    
    let _ = (file_id, address, text);
    Err("Engine not implemented - add_comment".to_string())
}

/// Get string list
#[tauri::command]
pub async fn get_strings(file_id: String) -> Result<Vec<(u64, String)>, String> {
    // TODO: Implement get string list logic
    
    let _ = file_id;
    Err("Engine not implemented - get_strings".to_string())
}

#[tauri::command]
pub fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    window
        .show()
        .map_err(|e| format!("Failed to show main window: {e}"))?;
    Ok(())
}