import { useNavigate } from "@tanstack/react-router";
import { AtlasLogin } from "../components/atlas-login";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Demo wiring. In your app, start your auth redirect here instead. */
export function LoginRoute() {
  const navigate = useNavigate();
  return (
    <AtlasLogin
      onLogin={async () => {
        await wait(1200);
        await navigate({ to: "/" });
      }}
    />
  );
}
