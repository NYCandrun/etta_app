import React from "react";
import { NavLink } from "react-router-dom";
import { useGamification } from "@/hooks/useGamification";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    to: "/lesson",
    label: "Lesson",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    to: "/quiz",
    label: "Quiz",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    to: "/projects",
    label: "Projects",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    to: "/progress",
    label: "Progress",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const { level, streak } = useGamification();

  return (
    <aside className="flex w-sidebar flex-col border-r border-warm-200 bg-white dark:border-warm-800 dark:bg-warm-900">
      {/* Logo */}
      <div className="flex h-topbar items-center gap-3 border-b border-warm-200 px-6 dark:border-warm-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-600 text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </div>
        <span className="text-lg font-semibold text-warm-900 dark:text-warm-100">
          Astrolabe
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-smooth ${
                isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
                  : "text-warm-600 hover:bg-warm-100 hover:text-warm-900 dark:text-warm-400 dark:hover:bg-warm-800 dark:hover:text-warm-100"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Streak & Level */}
      <div className="border-t border-warm-200 px-4 py-4 dark:border-warm-800">
        <div className="flex items-center gap-3">
          {/* Streak */}
          <div className="flex items-center gap-1.5">
            <span className="text-lg" role="img" aria-label="streak">
              <svg className="h-5 w-5 text-accent-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.75 2.25c.398 0 .72.322.72.72 0 3.476-1.012 5.46-2.206 7.045-.472.625-.98 1.17-1.454 1.711a32.52 32.52 0 00-.582.66c.274-.038.586-.026.922.05 1.162.267 2.234 1.07 2.857 2.702.398 1.04.525 2.392.184 4.074a.75.75 0 01-1.466-.306c.272-1.336.162-2.37-.12-3.11-.382-1.004-1.083-1.486-1.78-1.647-.832-.191-1.555.166-1.755.478a.75.75 0 01-1.313-.72c.16-.29.456-.68.839-1.13.494-.584 1.135-1.278 1.715-2.044C10.283 9.567 11.03 7.892 11.03 4.97c-2.117 1.572-4.281 4.636-4.281 9.28 0 3.07 1.3 5.136 3.066 6.367a.75.75 0 01-.867 1.225C6.767 20.293 5.25 17.695 5.25 14.25c0-5.77 3.12-9.583 5.84-11.37A.75.75 0 0112.75 2.25z" />
                <path d="M15.75 9c.398 0 .72.322.72.72 0 2.385-.732 3.956-1.6 5.175-.452.635-.95 1.144-1.393 1.627-.12.131-.237.26-.347.387.24-.017.498.015.77.08.895.216 1.738.826 2.234 2.124.32.836.422 1.905.154 3.247a.75.75 0 01-1.467-.305c.214-1.063.129-1.874-.077-2.413-.296-.774-.82-1.14-1.35-1.268-.617-.148-1.138.075-1.327.282a.75.75 0 01-1.178-.928c.2-.254.515-.621.919-1.044.49-.515 1.115-1.135 1.627-1.854.648-.91 1.134-2.041 1.195-3.65A7.516 7.516 0 0012 14.25a.75.75 0 010-1.5c2.676 0 4.5-2.239 4.5-4.5a.75.75 0 01.75-.75z" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-warm-700 dark:text-warm-300">
              {streak.currentDays}
            </span>
          </div>

          <div className="h-4 w-px bg-warm-200 dark:bg-warm-700" />

          {/* Level */}
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
              {level.current}
            </span>
            <span className="truncate text-xs text-warm-500 dark:text-warm-400">
              {level.title}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
