/**
 * Skills Manager
 * Manages skill files (markdown) in configured directories
 */

import fs from "fs";
import path from "path";
import type { SkillInfo, SkillsConfig } from "../types/agent.js";
import {
  loadSkillsConfig,
  saveSkillsConfig,
  addSkillDirectory as addDir,
  removeSkillDirectory as removeDir,
  toggleSkill as toggle,
  getDefaultSkillsDir,
  generateId,
} from "./storage.js";

/**
 * Scan a single directory for skill files (.md)
 */
function scanDirectory(dir: string, disabledSkills: string[]): SkillInfo[] {
  const skills: SkillInfo[] = [];

  if (!fs.existsSync(dir)) {
    return skills;
  }

  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      const name = path.basename(file, ".md");

      // Extract description from first line or first paragraph
      const lines = content.split("\n").filter((l) => l.trim());
      let description = "";
      for (const line of lines) {
        const trimmed = line.replace(/^#+\s*/, "").trim();
        if (trimmed && !trimmed.startsWith("---")) {
          description = trimmed;
          break;
        }
      }

      skills.push({
        id: `${path.basename(dir)}_${name}`,
        name,
        description: description.substring(0, 200),
        filename: file,
        directory: dir,
        content,
        enabled: !disabledSkills.includes(name),
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      });
    }
  } catch (error) {
    console.error(`Error scanning skill directory ${dir}:`, error);
  }

  return skills;
}

/**
 * Get all skills from all configured directories
 */
export function getAllSkills(): SkillInfo[] {
  const config = loadSkillsConfig();
  const skills: SkillInfo[] = [];

  for (const dir of config.directories) {
    skills.push(...scanDirectory(dir, config.disabledSkills));
  }

  return skills;
}

/**
 * Get a specific skill by ID
 */
export function getSkill(id: string): SkillInfo | undefined {
  return getAllSkills().find((s) => s.id === id);
}

/**
 * Get skill content by ID (full file content)
 */
export function getSkillContent(id: string): string | null {
  const skill = getSkill(id);
  if (!skill) return null;

  const filePath = path.join(skill.directory, skill.filename);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Create a new skill file
 */
export function createSkill(data: {
  name: string;
  content: string;
  directory?: string;
}): SkillInfo {
  const dir = data.directory || getDefaultSkillsDir();

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Sanitize filename
  const safeName = data.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const filename = `${safeName}.md`;
  const filePath = path.join(dir, filename);

  if (fs.existsSync(filePath)) {
    throw new Error(`Skill file already exists: ${filename}`);
  }

  fs.writeFileSync(filePath, data.content, "utf-8");

  const now = new Date().toISOString();
  return {
    id: `${path.basename(dir)}_${safeName}`,
    name: safeName,
    description: data.content.split("\n").filter((l) => l.trim())[0]?.replace(/^#+\s*/, "").trim().substring(0, 200) || "",
    filename,
    directory: dir,
    content: data.content,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update an existing skill file
 */
export function updateSkill(id: string, content: string): SkillInfo {
  const skill = getSkill(id);
  if (!skill) {
    throw new Error(`Skill not found: ${id}`);
  }

  const filePath = path.join(skill.directory, skill.filename);
  fs.writeFileSync(filePath, content, "utf-8");

  skill.content = content;
  skill.updatedAt = new Date().toISOString();

  // Update description
  const lines = content.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const trimmed = line.replace(/^#+\s*/, "").trim();
    if (trimmed && !trimmed.startsWith("---")) {
      skill.description = trimmed.substring(0, 200);
      break;
    }
  }

  return skill;
}

/**
 * Delete a skill file
 */
export function deleteSkill(id: string): boolean {
  const skill = getSkill(id);
  if (!skill) return false;

  const filePath = path.join(skill.directory, skill.filename);
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggle a skill enabled/disabled
 */
export function toggleSkillEnabled(name: string, enabled: boolean): SkillsConfig {
  return toggle(name, enabled);
}

/**
 * Get skill directories
 */
export function getSkillDirectories(): string[] {
  return loadSkillsConfig().directories;
}

/**
 * Add a skill directory
 */
export function addSkillDirectory(dir: string): SkillsConfig {
  return addDir(dir);
}

/**
 * Remove a skill directory
 */
export function removeSkillDirectory(dir: string): SkillsConfig {
  return removeDir(dir);
}

/**
 * Get skills config for session (directories, disabled skills)
 */
export function getSkillsForSession(): { skillDirectories: string[]; disabledSkills: string[] } {
  const config = loadSkillsConfig();
  return {
    skillDirectories: config.directories,
    disabledSkills: config.disabledSkills,
  };
}
