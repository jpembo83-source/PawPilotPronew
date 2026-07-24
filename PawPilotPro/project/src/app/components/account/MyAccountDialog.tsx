// My Account — self-service hub for the SIGNED-IN user's own account.
// Opened from the sidebar/mobile profile block. Everything here edits the
// current user only; security fields (role, permissions, tenant) are
// server-set and shown read-only. Team management is a LINK to
// Settings → Users & Access (admin/manager only) — never rebuilt here.

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Bell,
  Buildings,
  Camera,
  CircleNotch,
  Lock,
  Moon,
  SignOut,
  Trash,
  UsersThree,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useAccountStore } from '../../stores/accountStore';
import { useSettingsStore } from '../../modules/settings/store';
import { useDashboardStore } from '../../modules/dashboard/store';
import { supabase } from '../../../utils/supabase/client';
import { prepareAvatarForUpload } from '../../utils/imageCompression';
import {
  accessibleLocations,
  canDefaultToAllLocations,
  canManageTeam,
  NOTIFICATION_TYPE_LABELS,
  STAFF_NOTIFICATION_TYPES,
  validatePasswordForm,
  type StaffNotificationType,
  type ThemePref,
} from '../../lib/account';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const errorText = (e: unknown): string =>
  e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.';

export function MyAccountDialog() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    profile,
    avatarUrl,
    prefs,
    hasLoaded,
    isSaving,
    isAccountOpen,
    closeAccount,
    fetchAccount,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    savePrefs,
    changePassword,
    signOutOtherSessions,
  } = useAccountStore();
  const { locations } = useSettingsStore();
  const { setLocation } = useDashboardStore();

  // --- Profile form state (synced from the loaded profile) ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Password form state ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [lastSignInAt, setLastSignInAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isAccountOpen) return;
    setName(profile?.name ?? user?.name ?? '');
    setPhone(profile?.phone ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    if (!hasLoaded) void fetchAccount().catch(() => {});
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setLastSignInAt(session?.user?.last_sign_in_at ?? null);
    });
  }, [isAccountOpen, profile?.name, profile?.phone, hasLoaded, fetchAccount, user?.name]);

  if (!user) return null;

  const initials = (profile?.name || user.name || '?').charAt(0).toUpperCase();
  const locationOptions = accessibleLocations(user, locations);
  const showTeam = canManageTeam(user.role);

  const profileDirty =
    name.trim() !== (profile?.name ?? user.name ?? '') || phone.trim() !== (profile?.phone ?? '');

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      toast.success('Profile updated');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const handleAvatarFile = async (file: File | null) => {
    if (!file) return;
    try {
      const prepared = await prepareAvatarForUpload(file);
      await uploadAvatar(prepared);
      toast.success('Profile photo updated');
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await removeAvatar();
      toast.success('Profile photo removed');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const handleDefaultLocation = async (value: string) => {
    const next = value === 'NONE' ? null : value;
    try {
      await savePrefs({ defaultLocationId: next });
      // Apply straight away so "default" is visible without a reload.
      if (next) setLocation(next);
      toast.success('Default location saved');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const handleTheme = async (value: ThemePref) => {
    try {
      await savePrefs({ theme: value });
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const handleNotificationToggle = async (type: StaffNotificationType, enabled: boolean) => {
    try {
      await savePrefs({ notifications: { ...prefs.notifications, [type]: enabled } });
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const handleQuietHours = async (patch: Partial<typeof prefs.notifications.quietHours>) => {
    try {
      await savePrefs({
        notifications: {
          ...prefs.notifications,
          quietHours: { ...prefs.notifications.quietHours, ...patch },
        },
      });
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const handleChangePassword = async () => {
    const error = validatePasswordForm({ currentPassword, newPassword, confirmPassword });
    if (error) {
      toast.error(error);
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const handleSignOutEverywhere = async () => {
    try {
      await signOutOtherSessions();
      toast.success('Signed out of all other sessions');
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const quietHours = prefs.notifications.quietHours;

  return (
    <Dialog open={isAccountOpen} onOpenChange={(open) => !open && closeAccount()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>My Account</DialogTitle>
          <DialogDescription>
            Manage your own profile, preferences, and security. Role and permissions are managed by
            your administrator.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList className="w-full">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            {showTeam && <TabsTrigger value="team">Team</TabsTrigger>}
          </TabsList>

          {/* ---------------- PROFILE ---------------- */}
          <TabsContent value="profile" className="space-y-5 pt-2">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-1.5" aria-hidden="true" />
                    {avatarUrl ? 'Change photo' : 'Upload photo'}
                  </Button>
                  {avatarUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => void handleRemoveAvatar()}
                    >
                      <Trash className="h-4 w-4 mr-1.5" aria-hidden="true" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Photos are cropped square and shown in the sidebar and team directory.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleAvatarFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {/* Name / contact */}
            <div className="space-y-2">
              <Label htmlFor="account-name">Display name</Label>
              <Input
                id="account-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-phone">Phone</Label>
              <Input
                id="account-phone"
                type="tel"
                value={phone}
                maxLength={32}
                placeholder="e.g. 07700 900123"
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Shown in the team directory so colleagues can reach you.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email">Email</Label>
              <Input id="account-email" value={profile?.email ?? user.email} disabled />
              <p className="text-sm text-muted-foreground">
                Sign-in email — ask an administrator to change it.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-role">Role</Label>
              <Input
                id="account-role"
                className="capitalize"
                value={(profile?.role ?? user.role).replace('_', ' ')}
                disabled
              />
              <p className="text-sm text-muted-foreground">
                Role and permissions are set by your administrator.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void handleSaveProfile()} disabled={isSaving || !profileDirty}>
                {isSaving && <CircleNotch className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />}
                Save profile
              </Button>
            </div>
          </TabsContent>

          {/* ---------------- PREFERENCES ---------------- */}
          <TabsContent value="preferences" className="space-y-6 pt-2">
            {/* Default location */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Buildings className="h-4 w-4 text-primary" aria-hidden="true" />
                Default location
              </Label>
              <Select
                value={prefs.defaultLocationId ?? 'NONE'}
                onValueChange={(v) => void handleDefaultLocation(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No default (keep last used)</SelectItem>
                  {canDefaultToAllLocations(user.role) && (
                    <SelectItem value="ALL">All Locations</SelectItem>
                  )}
                  {locationOptions.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Dashboard, roster, and booking views start on this location when you sign in. You
                can still switch locations any time from the sidebar.
              </p>
            </div>

            {/* Appearance */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
                Appearance
              </Label>
              <Select value={prefs.theme} onValueChange={(v) => void handleTheme(v as ThemePref)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Match device</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notifications */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
                Notifications
              </Label>
              <div className="space-y-2.5">
                {STAFF_NOTIFICATION_TYPES.map((type) => (
                  <div key={type} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{NOTIFICATION_TYPE_LABELS[type]}</span>
                    <Switch
                      checked={prefs.notifications[type]}
                      aria-label={NOTIFICATION_TYPE_LABELS[type]}
                      onCheckedChange={(checked) => void handleNotificationToggle(type, checked)}
                    />
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Quiet hours</p>
                    <p className="text-sm text-muted-foreground">
                      Mutes the notification badge overnight. Alerts stay in the feed.
                    </p>
                  </div>
                  <Switch
                    checked={quietHours.enabled}
                    aria-label="Quiet hours"
                    onCheckedChange={(checked) => void handleQuietHours({ enabled: checked })}
                  />
                </div>
                {quietHours.enabled && (
                  <div className="flex items-center gap-3">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="quiet-start" className="text-sm">From</Label>
                      <Input
                        id="quiet-start"
                        type="time"
                        value={quietHours.start}
                        onChange={(e) => void handleQuietHours({ start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="quiet-end" className="text-sm">Until</Label>
                      <Input
                        id="quiet-end"
                        type="time"
                        value={quietHours.end}
                        onChange={(e) => void handleQuietHours({ end: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ---------------- SECURITY ---------------- */}
          <TabsContent value="security" className="space-y-6 pt-2">
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
                Change password
              </Label>
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-sm">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => void handleChangePassword()}
                  disabled={isSaving || !currentPassword || !newPassword}
                >
                  {isSaving && (
                    <CircleNotch className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />
                  )}
                  Change password
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Sessions</p>
              {lastSignInAt && (
                <p className="text-sm text-muted-foreground">
                  Last sign-in: {new Date(lastSignInAt).toLocaleString()}
                </p>
              )}
              <Button variant="outline" size="sm" onClick={() => void handleSignOutEverywhere()}>
                <SignOut className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Sign out everywhere else
              </Button>
              <p className="text-sm text-muted-foreground">
                Signs out every device except this one.
              </p>
            </div>
          </TabsContent>

          {/* ---------------- TEAM (admin/manager only) ---------------- */}
          {showTeam && (
            <TabsContent value="team" className="space-y-3 pt-2">
              <div className="rounded-lg border border-border p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <UsersThree className="h-4 w-4 text-primary" aria-hidden="true" />
                  Team accounts
                </p>
                <p className="text-sm text-muted-foreground">
                  Add colleagues, set roles and permissions, or deactivate accounts in Settings →
                  Users &amp; Access.
                </p>
                <Button
                  onClick={() => {
                    closeAccount();
                    void navigate('/settings/users');
                  }}
                >
                  Manage team accounts
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Quick logout affordance — the profile block used to be sign-out only */}
        <div className="flex justify-end border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              closeAccount();
              void logout();
            }}
          >
            <SignOut className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
