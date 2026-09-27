"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { ChevronDownIcon, HorizontaLDots, ListIcon } from "../icons/index";

import UrangGoldLogo from "../images/logo/uranggold-logo.svg";
import UrangGoldMark from "../images/logo/uranggold-mark.svg";
import {
  ArchiveBoxIcon,
  ArrowPathRoundedSquareIcon,
  ArrowsRightLeftIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ReceiptPercentIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TruckIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import UpgradeModal from "@/components/common/UpgradeModal";
import { useSession } from "@/context/SessionContext";
import type { Permission } from "@/lib/auth/permissions";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean; permission?: Permission | Permission[] }[];
  /** single permission, or a list meaning "any of these" */
  permission?: Permission | Permission[];
};

// Menu items are hidden by permission for UX only; pages/actions re-check on the server.
// Add modules here as each phase ships.
const navItems: NavItem[] = [
  {
    icon: <ListIcon />,
    name: "Dashboard",
    path: "/dashboard",
    permission: "dashboard.view",
  },
  {
    icon: <ShoppingCartIcon className="w-5 h-5" />,
    name: "Kasir (POS)",
    path: "/sales/new",
    permission: "pos.use",
  },
  {
    icon: <ReceiptPercentIcon className="w-5 h-5" />,
    name: "Penjualan",
    path: "/sales",
    permission: "sales.manage",
  },
  {
    icon: <ArrowsRightLeftIcon className="w-5 h-5" />,
    name: "Buyback",
    path: "/buybacks",
    permission: "buybacks.manage",
  },
  {
    icon: <ArrowPathRoundedSquareIcon className="w-5 h-5" />,
    name: "Tukar Tambah",
    path: "/trade-ins",
    permission: "trade_ins.manage",
  },
  {
    icon: <CubeIcon className="w-5 h-5" />,
    name: "Master Data",
    subItems: [
      { name: "Produk", path: "/products" },
      { name: "Kategori", path: "/categories" },
      { name: "Kadar Emas", path: "/purities" },
      { name: "Supplier", path: "/suppliers", permission: "master_data.manage" },
    ],
  },
  {
    icon: <CurrencyDollarIcon className="w-5 h-5" />,
    name: "Harga Emas",
    path: "/gold-rates",
  },
  {
    icon: <ArchiveBoxIcon className="w-5 h-5" />,
    name: "Inventory",
    subItems: [
      { name: "Daftar Stok", path: "/inventory", permission: ["inventory.view", "pos.use"] },
      { name: "Transfer", path: "/inventory/transfer", permission: "stock_transfer.manage" },
      { name: "Mutasi", path: "/inventory/movements", permission: "inventory.view" },
      { name: "Stock Opname", path: "/inventory/stock-opname", permission: ["stock_opname.manage", "stock_opname.approve", "reports.view"] },
      { name: "Lokasi & Baki", path: "/inventory/locations", permission: ["inventory.view", "pos.use"] },
    ],
  },
  {
    icon: <TruckIcon className="w-5 h-5" />,
    name: "Pembelian",
    path: "/purchases",
    permission: "purchases.manage",
  },
  {
    icon: <ChartBarIcon className="w-5 h-5" />,
    name: "Laporan",
    path: "/reports",
    permission: "reports.view",
  },
  {
    icon: <UserGroupIcon className="w-5 h-5" />,
    name: "Customer",
    path: "/customers",
    permission: "customers.manage",
  },
];

const othersItems: NavItem[] = [
  {
    icon: <UsersIcon className="w-5 h-5" />,
    name: "Pengguna",
    path: "/users",
    permission: "users.manage",
  },
  {
    icon: <BuildingStorefrontIcon className="w-5 h-5" />,
    name: "Outlet",
    path: "/stores",
    permission: "stores.manage",
  },
  {
    icon: <Cog6ToothIcon className="w-5 h-5" />,
    name: "Pengaturan",
    path: "/settings",
    permission: "tenant.manage",
  },
];

function filterByPermission(items: NavItem[], permissions: Permission[]): NavItem[] {
  const allowed = (p?: Permission | Permission[]) =>
    !p || (Array.isArray(p) ? p.some((x) => permissions.includes(x)) : permissions.includes(p));
  return items
    .filter((item) => allowed(item.permission))
    .map((item) => (item.subItems ? { ...item, subItems: item.subItems.filter((s) => allowed(s.permission)) } : item))
    .filter((item) => !item.subItems || item.subItems.length > 0);
}

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { permissions } = useSession();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const isGratis = false; // plan/billing is out of scope for Phase 1

  const filteredNavItems = useMemo(() => filterByPermission(navItems, permissions), [permissions]);
  const filteredOthersItems = useMemo(() => filterByPermission(othersItems, permissions), [permissions]);

  const [openSubmenu, setOpenSubmenu] = useState<{ type: "main" | "others"; index: number } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Only the most specific matching menu is active: /sales/new -> "Kasir (POS)", not also "Penjualan" (/sales).
  // Detail pages (/sales/123) still highlight their parent menu via the prefix match.
  const activePath = useMemo(() => {
    const paths = [...filteredNavItems, ...filteredOthersItems].flatMap((i) => [i.path, ...(i.subItems ?? []).map((s) => s.path)]);
    return paths
      .filter((p): p is string => !!p && (p === pathname || pathname.startsWith(`${p}/`)))
      .sort((a, b) => b.length - a.length)[0];
  }, [pathname, filteredNavItems, filteredOthersItems]);

  const isActive = useCallback((path: string) => path === activePath, [activePath]);

  useEffect(() => {
    let submenuMatched = false;
    [
      { menuType: "main", items: filteredNavItems },
      { menuType: "others", items: filteredOthersItems },
    ].forEach(({ menuType, items }) => {
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({ type: menuType as "main" | "others", index });
              submenuMatched = true;
            }
          });
        }
      });
    });
    if (!submenuMatched) setOpenSubmenu(null);
  }, [pathname, isActive, filteredNavItems, filteredOthersItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prev) =>
      prev && prev.type === menuType && prev.index === index ? null : { type: menuType, index }
    );
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-1">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
            >
              <span
                className={`${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType && openSubmenu?.index === index ? "rotate-180 text-brand-500" : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"}`}
              >
                <span className={`${isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-1 space-y-0.5 ml-8">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <>
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 ${
        isExpanded || isMobileOpen ? "w-[240px]" : isHovered ? "w-[240px]" : "w-[76px]"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="py-5 flex justify-center">
        {/* <Link href="/" className="flex items-center justify-center"> */}
          {isExpanded || isHovered || isMobileOpen ? (
            <UrangGoldLogo className="h-8 w-auto text-gray-900 dark:text-white" />
          ) : (
            <UrangGoldMark className="h-9 w-9" />
          )}
        {/* </Link> */}
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1">
        <nav className="mb-4">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-2 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots />}
              </h2>
              {renderMenuItems(filteredNavItems, "main")}
            </div>

            {filteredOthersItems.length > 0 && (
              <div>
                <h2
                  className={`mb-2 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? "Lainnya" : <HorizontaLDots />}
                </h2>
                {renderMenuItems(filteredOthersItems, "others")}
              </div>
            )}
          </div>
        </nav>
      </div>
      {/* ── Mulai Berlangganan ── */}
      {isGratis && (isExpanded || isHovered || isMobileOpen) && (
        <div className="px-4 pb-6 mt-auto">
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition"
          >
            <SparklesIcon className="w-4 h-4" />
            Mulai Berlangganan
          </button>
        </div>
      )}
    </aside>

      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
    </>
  );
};

export default AppSidebar;
