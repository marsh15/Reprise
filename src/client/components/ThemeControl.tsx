import { themeOptions, useTheme } from '../theme';

/** Light / System / Dark. System follows the OS live (tokens.css), so it is the default. */
export function ThemeControl() {
  const [preference, choose] = useTheme();
  return <div className="theme-control" role="group" aria-label="Theme">
    {themeOptions.map(option => <button key={option.value} type="button" className="theme-option" aria-pressed={preference === option.value} onClick={() => choose(option.value)}>{option.label}</button>)}
  </div>;
}
