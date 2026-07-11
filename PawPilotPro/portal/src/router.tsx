import { createBrowserRouter } from "react-router-dom";
import { RouteErrorFallback } from "@/components/ErrorBoundary";
import { RequirePortalAuth } from "@/components/RequirePortalAuth";
import { AppShell } from "@/components/AppShell";
import { LoginScreen } from "@/screens/LoginScreen";
import { LoginCodeScreen } from "@/screens/LoginCodeScreen";
import { AcceptInviteScreen } from "@/screens/AcceptInviteScreen";
import { ForgotPasswordScreen } from "@/screens/ForgotPasswordScreen";
import { ResetPasswordScreen } from "@/screens/ResetPasswordScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { BookingsScreen } from "@/screens/BookingsScreen";
import { BookingDetailScreen } from "@/screens/BookingDetailScreen";
import { BookingFlow } from "@/screens/booking/BookingFlow";
import { PetsScreen } from "@/screens/PetsScreen";
import { PetDetailScreen } from "@/screens/PetDetailScreen";
import { PetEditScreen } from "@/screens/PetEditScreen";
import { VaxUploadScreen } from "@/screens/VaxUploadScreen";
import { AddPetScreen } from "@/screens/AddPetScreen";
import { AccountScreen } from "@/screens/AccountScreen";
import { HouseholdScreen } from "@/screens/HouseholdScreen";
import { ContactsScreen } from "@/screens/ContactsScreen";
import { ContactEditScreen } from "@/screens/ContactEditScreen";
import { DocumentsScreen } from "@/screens/DocumentsScreen";
import { DocumentUploadScreen } from "@/screens/DocumentUploadScreen";
import { TrackerScreen } from "@/screens/TrackerScreen";
import { PetTimelineScreen } from "@/screens/PetTimelineScreen";
import { VetShareScreen } from "@/screens/VetShareScreen";
import { VetViewScreen } from "@/screens/VetViewScreen";
import { PulseScreen } from "@/screens/PulseScreen";
import { WhereaboutsScreen } from "@/screens/WhereaboutsScreen";
import { TrackerUpsellScreen } from "@/screens/TrackerUpsellScreen";
import { MembershipsScreen } from "@/screens/MembershipsScreen";
import { GalleryScreen } from "@/screens/GalleryScreen";

export const router = createBrowserRouter([
  {
    // Pathless root route: its errorElement catches render errors from every
    // route below, replacing the router's unstyled default error page
    // (data routers trap render errors before any outer React error boundary).
    errorElement: <RouteErrorFallback />,
    children: [
      { path: "/login", element: <LoginScreen /> },
      { path: "/login/code", element: <LoginCodeScreen /> },
      // Public read-only vet view — no auth wrapper
      { path: "/vet/:token", element: <VetViewScreen /> },
      { path: "/accept-invite", element: <AcceptInviteScreen /> },
      { path: "/forgot-password", element: <ForgotPasswordScreen /> },
      { path: "/reset-password", element: <ResetPasswordScreen /> },
      {
        element: (
          <RequirePortalAuth>
            <AppShell />
          </RequirePortalAuth>
        ),
        children: [
          { path: "/", element: <HomeScreen /> },
          { path: "/bookings", element: <BookingsScreen /> },
          { path: "/bookings/:id", element: <BookingDetailScreen /> },
          { path: "/book", element: <BookingFlow /> },
          { path: "/pets", element: <PetsScreen /> },
          { path: "/pets/add", element: <AddPetScreen /> },
          { path: "/pets/:id", element: <PetDetailScreen /> },
          { path: "/pets/:id/edit", element: <PetEditScreen /> },
          { path: "/pets/:id/vax/upload", element: <VaxUploadScreen /> },
          { path: "/pets/:id/tracker", element: <TrackerScreen /> },
          { path: "/pets/:id/timeline", element: <PetTimelineScreen /> },
          { path: "/pets/:id/vet-share", element: <VetShareScreen /> },
          { path: "/pets/:id/pulse", element: <PulseScreen /> },
          { path: "/pets/:id/whereabouts", element: <WhereaboutsScreen /> },
          { path: "/tracker/upsell", element: <TrackerUpsellScreen /> },
          { path: "/gallery", element: <GalleryScreen /> },
          { path: "/memberships", element: <MembershipsScreen /> },
          { path: "/account", element: <AccountScreen /> },
          { path: "/account/household", element: <HouseholdScreen /> },
          { path: "/account/people", element: <ContactsScreen /> },
          { path: "/account/people/new", element: <ContactEditScreen /> },
          { path: "/account/people/:id", element: <ContactEditScreen /> },
          { path: "/account/documents", element: <DocumentsScreen /> },
          { path: "/account/documents/upload", element: <DocumentUploadScreen /> },
        ],
      },
    ],
  },
]);
