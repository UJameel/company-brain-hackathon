"use client";
import { UserMenu } from "./UserMenu";

export function TopBar() {
  return (
    <header className="flex h-[72px] items-center justify-between border-b border-line px-6">
      <div className="font-serif text-lg">Northwind Labs</div>
      <UserMenu />
    </header>
  );
}
