'use client';

import { NavbarInteractive } from './NavbarInteractive';

interface ClientLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  return (
    <>
      <NavbarInteractive />
      <main className="flex-1 pt-14">
        {children}
      </main>
    </>
  );
}