import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Bell, ChevronDown, Container, LayoutDashboard, MapPin, Network, Package, Search, Ship } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SIM_START_SEC, fmtClock, timeControl, useClock } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";
import { ALERTS, BERTH_COUNT, CARRIER_NAME, PORT_NAME } from "@/data/port";
import { AlertRow } from "./AlertsPanel";

const TABS = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/vessels", label: "Vessels", icon: Ship, end: false },
  { to: "/yard", label: "Yard", icon: Container, end: false },
  { to: "/shipments", label: "Shipments", icon: Package, end: false },
  { to: "/logistics", label: "Logistics", icon: Network, end: false },
];

function LiveClock() {
  const snap = useClock();
  const time = <span className="font-mono text-ink tnum">{fmtClock(SIM_START_SEC + snap.t, true)}</span>;
  if (snap.live) {
    return (
      <div className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-moss lg:flex" aria-live="off">
        <span className="h-2 w-2 rounded-full bg-moss pw-blink" />
        Live
        {time}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => timeControl.goLive()}
      title="Jump to live"
      className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-signal/40 bg-signal-soft px-3 py-1.5 text-[12.5px] font-semibold text-[#B8441A] hover:brightness-[0.98] lg:flex"
    >
      <span className="h-2 w-2 rounded-full bg-signal" />
      {snap.rate === 0 ? "Paused" : "Replay"}
      {time}
    </button>
  );
}

export function TopBar() {
  const { setSearchOpen, open } = usePort();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearchOpen]);

  return (
    <header
      className="pw-safe-x absolute inset-x-0 top-0 z-30 flex items-center gap-1.5 border-b border-hairline bg-paper/95 backdrop-blur-sm [--pad-x:0.625rem] sm:gap-2 md:gap-4 md:[--pad-x:1.25rem]"
      style={{ height: "var(--hud-top)", paddingTop: "var(--sat)" }}
    >
      <NavLink to="/" className="flex shrink-0 items-center gap-2 rounded-md max-[359px]:hidden" aria-label="Portwise – Overview">
        <img src="/icon.png" alt="" className="h-8 w-8 rounded-[9px]" />
        <span className="hidden text-[19px] font-extrabold tracking-tight text-ink sm:inline">Portwise</span>
      </NavLink>

      <nav aria-label="Main navigation" className="flex min-w-0 items-center gap-0.5 md:ml-2">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "flex h-10 min-w-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-2 text-[13.5px] font-semibold transition-colors max-[359px]:min-w-9 max-[359px]:px-1.5 sm:px-2.5 xl:px-3",
                isActive ? "bg-signal-soft text-[#B8441A]" : "text-ink/80 hover:bg-sand hover:text-ink",
              )
            }
          >
            <t.icon className="h-[18px] w-[18px] shrink-0 xl:h-[17px] xl:w-[17px]" aria-hidden="true" />
            <span className="sr-only xl:not-sr-only">{t.label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Search vessels, containers, trucks and sites"
        className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-[11px] border border-hairline bg-canvas/60 text-left text-[13px] text-slate transition-colors hover:bg-sand md:ml-2 md:flex md:w-[220px] md:items-center md:gap-2.5 md:px-3 lg:w-[260px] 2xl:w-[340px]"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate md:inline">Search vessels, containers, trucks, sites…</span>
        <kbd className="ml-auto hidden rounded-md border border-hairline bg-paper px-1.5 py-0.5 font-mono text-[10.5px] text-slate md:inline">⌘K</kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-sand 2xl:flex">
            <MapPin className="h-3.5 w-3.5 text-signal" />
            {PORT_NAME} · Singapore
            <ChevronDown className="h-3.5 w-3.5 text-slate" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate">Authorized terminals</DropdownMenuLabel>
            <DropdownMenuItem className="flex items-center justify-between font-semibold">
              {PORT_NAME} · {BERTH_COUNT} berths
              <span className="text-[11px] font-medium text-moss">Viewing</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Tuas Port · not connected</DropdownMenuItem>
            <DropdownMenuItem disabled>Jurong Port · not connected</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <LiveClock />

        <Popover>
          <PopoverTrigger className="relative grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-sand" aria-label={`Alerts (${ALERTS.length})`}>
            <Bell className="h-[19px] w-[19px]" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-paper bg-signal" />
          </PopoverTrigger>
          <PopoverContent align="end" collisionPadding={12} className="w-[min(360px,calc(100vw-24px))] rounded-[14px] border-hairline bg-paper p-2">
            <p className="px-2 pb-1 pt-1 text-[14px] font-bold text-ink">All alerts</p>
            <ul className="scroll-thin max-h-[min(420px,60dvh)] overflow-y-auto overscroll-contain">
              {ALERTS.map((a) => (
                <AlertRow key={a.id} alert={a} onOpen={() => open(a.target)} />
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <div className="hidden items-center gap-2.5 pl-1 md:flex">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-ink text-[12.5px] font-bold text-paper">AN</div>
          <div className="hidden whitespace-nowrap leading-tight min-[1700px]:block">
            <p className="text-[13px] font-semibold text-ink">Alex Nguyen</p>
            <p className="text-[11.5px] text-slate">{CARRIER_NAME}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
