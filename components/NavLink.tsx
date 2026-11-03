"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

// 누른 뒤 다음 화면이 뜨기 전까지 글자 아래에 막대를 보여, 클릭이 됐다는 걸 알려 준다.
// 막대는 늘 자리를 차지하고 투명도만 바뀌어 메뉴가 흔들리지 않는다.
function PendingBar() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-current transition-opacity ${
        pending ? "animate-pulse opacity-100 delay-100" : "opacity-0"
      }`}
    />
  );
}

// 머리글 메뉴 링크. 지금 보고 있는 화면(하위 화면 포함)이면 파란색으로 표시한다.
export default function NavLink({ href, children, className = "" }: NavLinkProps) {
  const pathname = usePathname();
  const isCurrent = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={`relative ${
        isCurrent ? "font-medium text-blue-600 dark:text-blue-400" : "text-zinc-600 dark:text-zinc-400"
      } ${className}`}
    >
      {children}
      <PendingBar />
    </Link>
  );
}
