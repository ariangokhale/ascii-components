import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { GlobePlayground } from "./routes/GlobePlayground";
import { LoginRoute } from "./routes/LoginRoute";

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: GlobePlayground,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginRoute,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, loginRoute]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
