/**
 * CONTENT & SETTINGS PROVIDER.
 * Loaded directly from settings.json in the project root.
 * Edit settings.json to customize all texts, bio, projects, skills, socials, and UI labels.
 */
import rawSettings from '../../settings.json';

export interface Project {
  id: string;
  title: string;
  category: string;
  year: string;
  summary: string;
  description: string[];
  stack: string[];
  image: string;
  link?: string;
  repo?: string;
}

export interface Skill {
  name: string;
  level: number;
  group: 'core' | 'graphics' | 'tooling';
}

export const settings = rawSettings;

export const content = {
  brand: settings.personal.brand,
  name: settings.personal.name,
  role: settings.personal.role,
  tagline: settings.personal.tagline,
  location: settings.personal.location,
  email: settings.personal.email,
  bio: settings.sections.about.bio,
  stats: settings.sections.about.stats,
  projects: settings.sections.projects.items as Project[],
  skills: settings.sections.skills.items as Skill[],
  socials: settings.sections.contact.socials,
  seo: settings.seo,
  navigation: settings.navigation,
  sections: settings.sections,
  ui: settings.ui,
};

export type Content = typeof content;
export type Settings = typeof settings;
