import { redirect } from 'next/navigation';

// FIX-19: /settings không có index page → 404. Redirect về /settings/users mặc định.
export default function SettingsPage() {
  redirect('/settings/users');
}
