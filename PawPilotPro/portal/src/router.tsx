import { createBrowserRouter } from "react-router-dom";
import { RequirePortalAuth } from "@/components/RequirePortalAuth";
import { LoginScreen } from "@/screens/LoginScreen";
import { AcceptInviteScreen } from "@/screens/AcceptInviteScreen";
import { HomeScreen } from "@/screens/HomeScreen";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginScreen /> },
  { path: "/accept-invite", element: <AcceptInviteScreen /> },
  {
    path: "/",
    element: (
      <RequirePortalAuth>
        <HomeScreen />
      </RequirePortalAuth>
    ),
  },
  {
    path: "*",
    element: (
      <RequirePortalAuth>
        <HomeScreen />
      </RequirePortalAuth>
    ),
  },
]);
