# Frontend Additions for Security Updates

## 🎯 Overview

These frontend additions complement the backend security improvements while maintaining design consistency.

---

## 📋 Recommended Features by Priority

### **Priority 1: CRITICAL** (User Needs to Know)

#### 1. **Session Invalidation Warning** (Before password change)
**Impact:** High - Users need to understand password change consequences  
**Consistency:** Add inline alert in `SecurityForm`

```tsx
// In src/components/settings/security-form.tsx
// Add before the form submission area:
<Alert type="warning" title="Important">
  Changing your password will log you out of all other sessions. 
  You'll need to sign in again.
</Alert>
```

**File to modify:** `src/components/settings/security-form.tsx`

---

#### 2. **Password Reuse Prevention Notice** (In password input)
**Impact:** Medium - Users need context for error message  
**Consistency:** Enhance existing hint text

```tsx
// Update the New Password input hint:
<Input
  label="New password"
  type="password"
  hint="At least 8 characters. Cannot reuse recent passwords."
  // ... rest of props
/>
```

---

#### 3. **Success Message with Action** (After password change)
**Impact:** Medium - Inform user about session logout  
**Consistency:** Enhance existing success message

Current:
```
"Password changed."
```

Improved:
```
"Password changed successfully. You'll be logged out and need to sign in again."
```

Then auto-redirect to login after 2 seconds.

---

### **Priority 2: HIGH** (Nice to Have)

#### 4. **Active Sessions Tab** (New settings section)
**Impact:** High - Users want to manage their sessions  
**Consistency:** Add as new subsection in Security settings

**New File:** `src/app/[role]/settings/sessions/page.tsx`

**Display:**
- List of active sessions (device, location, last activity)
- Logout other sessions button
- Current session highlighted
- Ability to revoke individual sessions

```tsx
// Example UI structure
Sessions
├── Current Session (This device)
│   └── [Logout Other Sessions button]
├── Session 2 (Chrome, Linux)
│   └── [Logout button]
└── Session 3 (Safari, macOS)
    └── [Logout button]
```

**Backend needed:**
- API endpoint to list sessions: `GET /api/[role]/sessions`
- API endpoint to revoke session: `DELETE /api/[role]/sessions/[id]`

---

#### 5. **Security Activity Log** (New settings section)
**Impact:** High - Users want to see account activity  
**Consistency:** Add as new subsection in Security settings

**New File:** `src/app/[role]/settings/activity/page.tsx`

**Display:**
- Recent security events (last 30 days)
- Event type (login, password change, 2FA, logout)
- Timestamp and IP address
- Device/Browser info
- Status (success/failed)

```tsx
// Example UI structure
Activity Log
├── Password changed - Jun 4, 2:30 PM
│   └── IP: 192.168.1.1 | Browser: Chrome on macOS
├── Login - Jun 4, 2:15 PM
│   └── IP: 192.168.1.1 | Browser: Chrome on macOS
└── Failed login - Jun 3, 11:45 PM
    └── IP: 203.0.113.5 | Reason: Invalid credentials
```

**Backend needed:**
- API endpoint to list events: `GET /api/[role]/activity`

---

### **Priority 3: MEDIUM** (Owner/Admin only)

#### 6. **API Key Expiration Display** (Enhanced)
**Impact:** Medium - Only for developers  
**Consistency:** Update existing API key management pages

**Changes needed:**
- Show expiration date on each API key
- Visual indicator when expiring soon (< 30 days)
- "Rotate" button for expiring keys
- "Set Expiration" option when creating keys

```tsx
// Example enhancement
<ApiKeyListItem>
  <KeyName>Production API Key</KeyName>
  <CreatedDate>May 4, 2025</CreatedDate>
  <ExpiresDate status="warning">Aug 2, 2026 (61 days)</ExpiresDate>
  <Actions>
    [Copy] [Rotate] [Revoke]
  </Actions>
</ApiKeyListItem>
```

**Files to modify:**
- `src/app/admin/projects/[id]/api-keys/page.tsx`
- `src/app/client/projects/[id]/api-keys/page.tsx`

---

#### 7. **Password History Policy Info** (Info card)
**Impact:** Low - Informational  
**Consistency:** Add as collapsible info section in Security

**Display:**
- "You cannot reuse any of your last 5 passwords"
- "Helps prevent account compromise from password leaks"
- Simple info icon with tooltip

---

## 🏗️ Implementation Structure

### New Components to Create

```
src/components/settings/
├── session-list.tsx          // Display active sessions
├── activity-log.tsx          // Display security events
├── session-invalidation-alert.tsx  // Warning before password change
└── api-key-expiration-badge.tsx    // Visual indicator for expiring keys
```

### New Pages to Create

```
src/app/*/settings/
├── sessions/page.tsx         // Active sessions management
└── activity/page.tsx         // Security activity log
```

### Updated Navigation

```
Settings Shell
├── Profile
├── Email
├── Security
│   ├── Password
│   ├── Two-Factor Auth
│   ├── Sessions          ← NEW
│   └── Activity          ← NEW
├── Appearance
└── [Owner-only sections]
```

---

## 🎨 Design Consistency

### Follow Existing Patterns

1. **Card Layout** - Use `<Card>` component (already used in security page)
2. **Form Inputs** - Use `<Input>`, `<Button>`, `<Alert>` components
3. **Icons** - Use `lucide-react` (already used in two-factor-section)
4. **Colors** - Follow existing color scheme:
   - Warning: `text-amber-600`, `bg-amber-50`
   - Success: `text-emerald-600`, `bg-emerald-50`
   - Danger: `text-red-600`, `bg-red-50`
   - Info: `text-blue-600`, `bg-blue-50`
5. **Spacing** - Use `space-y-4`, `space-y-6` classes
6. **Typography** - Use existing Tailwind scale (text-sm, text-base, etc.)

### Example Structure (Follow This)

```tsx
// File: src/app/owner/settings/sessions/page.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SessionList } from "@/components/settings/session-list";

export default async function SessionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const sessions = await prisma.session.findMany({
    where: { targetId: session.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert type="info">
          Manage devices and sessions using your account
        </Alert>
        <SessionList sessions={sessions} currentSessionId={session.id} />
      </CardContent>
    </Card>
  );
}
```

---

## 🔌 Backend Requirements

### New API Endpoints Needed

```
GET  /api/[role]/sessions           - List active sessions
DELETE /api/[role]/sessions/[id]    - Revoke specific session
POST /api/[role]/sessions/revoke-all - Revoke all other sessions

GET  /api/[role]/activity           - Get security activity log
GET  /api/[role]/activity/[id]      - Get single event details

POST /api/[role]/api-keys/rotate    - Rotate expiring API key
```

### Enhancement to Existing Endpoints

```
POST /api/[role]/api-keys           
  - Add optional: expiresInDays (default: 365)
```

---

## 📊 Recommended Rollout Order

1. **Week 1:** Session invalidation warning + success message
2. **Week 2:** Password reuse prevention notice + info card
3. **Week 3:** Active sessions page (backend + frontend)
4. **Week 4:** Security activity log (backend + frontend)
5. **Week 5:** API key expiration display + rotation UI

---

## ✨ Optional (Phase 2)

- Email notifications for new sessions
- Suspicious activity alerts (new country/IP)
- Device fingerprinting & naming
- Push notifications for session changes
- Location-based session display (via IP geolocation)
- Export activity log as PDF

---

## 🔄 Consistency Checklist

- [ ] All new pages follow `src/app/[role]/settings/[section]/page.tsx` pattern
- [ ] All components import from `@/components/ui/`
- [ ] All icons from `lucide-react`
- [ ] Styling uses existing Tailwind classes
- [ ] Error messages match existing tone
- [ ] Loading states use `loading` prop on buttons
- [ ] API calls use `apiFetch` helper
- [ ] Forms validate before submission
- [ ] Mobile-responsive (test on small screens)
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Consistent spacing (space-y-4, space-y-6)
- [ ] Consistent typography (Card/CardHeader/CardTitle)

---

## 📝 Summary

| Feature | Priority | Who Sees It | Files to Create | Complexity |
|---------|----------|------------|-----------------|-----------|
| Session invalidation warning | CRITICAL | All users | Modify existing | Very Low |
| Password reuse notice | CRITICAL | All users | Modify existing | Low |
| Success message enhancement | CRITICAL | All users | Modify existing | Low |
| Active sessions tab | HIGH | All users | 2-3 new files | Medium |
| Activity log | HIGH | All users | 2-3 new files | Medium |
| API key expiration display | MEDIUM | Owner/Admin | Modify existing | Low |
| Password history info | LOW | All users | Modify existing | Very Low |

---

## 🎯 Key Principles

1. **Inform without alarming** - Users should understand security changes
2. **Empower users** - Let them manage their own sessions
3. **Transparency** - Show what's happening with their account
4. **Consistency** - All pages look/feel the same
5. **Simplicity** - Don't overload with information

Start with Priority 1 (5 min implementation), then move to Priority 2 (1-2 day implementation).
