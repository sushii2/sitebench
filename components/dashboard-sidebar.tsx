"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import {
  dashboardCollectionLabels,
  dashboardNavItems,
} from "@/components/dashboard-nav"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { resolveBrandWebsitePreview } from "@/lib/brands"
import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"
import { cn } from "@/lib/utils"

function getInitials(label: string) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return initials || "?"
}

function DashboardSidebarBrandHeader({
  brandName,
  isCollapsed,
  website,
}: {
  brandName: string
  isCollapsed: boolean
  website: string
}) {
  const [logoFailed, setLogoFailed] = React.useState(false)

  React.useEffect(() => {
    setLogoFailed(false)
  }, [website])

  let brandPreview: ReturnType<typeof resolveBrandWebsitePreview> | null = null

  try {
    const publishableKey = resolveLogoDevPublicConfig().publishableKey
    brandPreview = resolveBrandWebsitePreview(website, publishableKey)
  } catch {
    brandPreview = null
  }

  const websiteLabel = brandPreview?.origin ?? website.trim()
  const fallbackLabel = getInitials(brandName || brandPreview?.domain || website)

  return (
    <div
      aria-label={`Brand navigation for ${brandName}`}
      className={cn(
        "flex items-center gap-3 px-2 py-1",
        isCollapsed && "justify-center px-0"
      )}
    >
      <Avatar className="size-8 rounded-none" size="sm">
        {brandPreview && !logoFailed ? (
          <AvatarImage
            className="rounded-none object-contain"
            src={brandPreview.logoUrl}
            alt={`${brandName} logo`}
            onError={() => {
              setLogoFailed(true)
            }}
          />
        ) : null}
        <AvatarFallback className="rounded-none text-[10px] font-medium uppercase">
          {fallbackLabel}
        </AvatarFallback>
      </Avatar>
      {isCollapsed ? null : (
        <div className="grid min-w-0 flex-1 text-left">
          <span className="truncate text-sm font-semibold">{brandName}</span>
          <span className="truncate text-xs text-sidebar-foreground/70">
            {websiteLabel}
          </span>
        </div>
      )}
    </div>
  )
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { brand, signOut, user } = useAuth()
  const { state } = useSidebar()
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  const userName = user?.profile?.name ?? "Account"
  const userEmail = user?.email ?? ""
  const isCollapsed = state === "collapsed"
  const brandName = brand?.company_name?.trim() || "Brand"
  const brandWebsite = brand?.website?.trim() || ""

  async function handleSignOut() {
    setIsSigningOut(true)

    try {
      await signOut()
      router.replace("/")
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <DashboardSidebarBrandHeader
          brandName={brandName}
          isCollapsed={isCollapsed}
          website={brandWebsite}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardNavItems.map((item) => {
                const isActive = pathname === item.href

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        {isCollapsed ? null : (
          <SidebarGroup>
            <SidebarGroupLabel>Collections</SidebarGroupLabel>
            <SidebarGroupContent className="space-y-1 px-2 py-1">
              {dashboardCollectionLabels.map((label) => (
                <div
                  key={label}
                  className="px-2 py-1 text-xs text-sidebar-foreground/80"
                >
                  {label}
                </div>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        {isCollapsed ? (
          <div className="flex justify-center px-2 py-1">
            <HoverCard openDelay={0} closeDelay={120}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-none ring-sidebar-ring outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2"
                  aria-label={`Account menu for ${userName || userEmail || "account"}`}
                >
                  <Avatar className="size-9 rounded-none">
                    <AvatarFallback className="rounded-none text-xs">
                      {getInitials(userName || userEmail || "SB")}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                className="flex w-48 flex-col gap-2 p-2"
                side="right"
                align="end"
                sideOffset={12}
              >
                <div className="grid gap-0.5 px-1 py-0.5">
                  <span className="truncate text-xs font-medium text-foreground">
                    {userName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start rounded-none"
                  disabled={isSigningOut}
                  onClick={() => {
                    void handleSignOut()
                  }}
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </Button>
              </HoverCardContent>
            </HoverCard>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-2 py-1">
              <Avatar className="size-9 rounded-none">
                <AvatarFallback className="rounded-none text-xs">
                  {getInitials(userName || userEmail || "SB")}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left">
                <span className="truncate text-sm font-medium">{userName}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {userEmail}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none"
              onClick={() => {
                void handleSignOut()
              }}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
          </>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
