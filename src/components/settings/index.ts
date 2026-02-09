/**
 * Settings Components
 * 
 * - SettingsPanel: Original modal-based settings (legacy)
 * - SettingsPage: New full-page settings with navigation tabs
 * - GeneralSettings: General settings content (used within SettingsPage)
 * - SlashCommandsSettings: Slash commands management (used within SettingsPage)
 * 
 * @example
 * // Using the new SettingsPage:
 * import { SettingsPage } from './components/settings';
 * 
 * function App() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   return (
 *     <>
 *       <button onClick={() => setIsOpen(true)}>Settings</button>
 *       <SettingsPage 
 *         isOpen={isOpen} 
 *         onClose={() => setIsOpen(false)}
 *         initialTab="slash-commands"
 *       />
 *     </>
 *   );
 * }
 */

export { SettingsPanel } from './SettingsPanel';
export { SettingsPage, type SettingsTab } from './SettingsPage';
export { GeneralSettings } from './GeneralSettings';
export { SlashCommandsSettings } from './SlashCommandsSettings';
export { UpdateChecker } from './UpdateChecker';
