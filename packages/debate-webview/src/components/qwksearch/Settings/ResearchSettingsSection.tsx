"use client";

/**
 * @fileoverview One research-agent settings section (Models, Connectors,
 * Search Sources…), rendered as a tab of `/settings`.
 *
 * Loaded lazily by `components/settings/ResearchSettingsTab`: the panes are
 * ~670 kB minified (the MCP section alone bundles the whole OpenConnector
 * provider index), so they load only when one of their tabs is opened.
 *
 * @module components/qwksearch/Settings/ResearchSettingsSection
 */

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import grab from 'grab-url';
import { toast } from 'sonner';
import { AnimatedLoader } from '../../ui/AnimatedLoader';
import { highlightAnchor } from './anchors';
import Account from './Sections/Account';
import Models from './Sections/Models/Section';
import MCPServers from './Sections/MCPServers/Section';
import SearchSection from './Sections/Search';
import SearchEngines from './Sections/SearchEngines';
import FileSources from './Sections/FileSources';
import AIRewriteModes from './Sections/AIRewriteModes';
import VoiceSection from './Sections/Voice';
import SkillsAndMemory from './Sections/SkillsAndMemory';
import { settingsSections } from 'research-agent-ui/settings';

// The section list (order, labels, descriptions) is declared as data in
// research-agent-ui; the React components stay here and are keyed back onto it.
const SECTION_COMPONENTS: Record<string, ComponentType<any>> = {
  account: Account,
  models: Models,
  mcpservers: MCPServers,
  'skills-memory': SkillsAndMemory,
  searchEngines: SearchEngines,
  search: SearchSection,
  fileSources: FileSources,
  aiRewriteModes: AIRewriteModes,
  voice: VoiceSection,
};

export default function ResearchSettingsSection({ sectionKey }: { sectionKey: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const section = settingsSections.find((s) => s.key === sectionKey);
  const Component = SECTION_COMPONENTS[sectionKey];

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const data = await grab('config');
      // grab resolves with the response body even on HTTP errors, so an
      // error payload ({ message }) would otherwise be stored as the config
      if (!data?.fields || !data?.values) {
        throw new Error(data?.message ?? 'Invalid configuration response.');
      }
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error('Failed to load configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Scroll to and highlight the field targeted by the URL hash, both on
  // deep links and on later hash changes
  useEffect(() => {
    if (isLoading || !config) return;
    const highlightFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      // let the section's fields render before looking up the element
      requestAnimationFrame(() => highlightAnchor(hash));
    };
    highlightFromHash();
    window.addEventListener('hashchange', highlightFromHash);
    return () => window.removeEventListener('hashchange', highlightFromHash);
  }, [isLoading, config, sectionKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 w-full">
        <AnimatedLoader />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-10 w-full space-y-3">
        <p className="text-sm text-black/70 dark:text-white/70">Failed to load settings.</p>
        <button
          onClick={fetchConfig}
          className="px-3 py-1.5 rounded-lg text-sm bg-light-200 dark:bg-dark-200 text-black/90 dark:text-white/90 hover:bg-light-300 hover:dark:bg-dark-300 transition duration-200 active:scale-95"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!section || !Component) return null;

  return (
    <Component fields={config.fields?.[section.dataAdd]} values={config.values?.[section.dataAdd]} />
  );
}
