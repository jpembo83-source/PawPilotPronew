import { createBrowserRouter } from "react-router-dom";
import { RequirePortalAuth } from "@/components/RequirePortalAuth";
import { AppShell } from "@/components/AppShell";
import { LoginScreen } from "@/screens/LoginScreen";
import { AcceptInviteScreen } from "@/screens/AcceptInviteScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { BookingsScreen } from "@/screens/BookingsScreen";
import { PetsScreen } from "@/screens/PetsScreen";
import { PetDetailScreen } from "@/screens/PetDetailScreen";
import { AccountScreen } from "@/screens/AccountScreen";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginScreen /> },
  { path: "/accept-invite", element: <AcceptInviteScreen /> },
  {
    element: (
      <RequirePortalAuth>
        <AppShell />
      </RequirePortalAuth>
    ),
    children: [
      { path: "/", element: <HomeScreen /> },
      { path: "/bookings", element: <BookingsScreen /> },
      { path: "/pets", element: <PetsScreen /> },
      { path: "/pets/:id", element: <PetDetailScreen /> },
      { path: "/account", element: <AccountScreen /> },
    ],
  },
]);
