// Railway Infrastructure as Code (zamjena za railway.json od 2026-11).
// Primjena: `railway config plan` (pregled) → `railway config apply` (upis u servis).
// Fajl se NE čita pri git push-u — podešavanja žive u servisu nakon apply-a.
// Varijable su "unmanaged": apply ih ne dira (tajne ostaju samo u Railway-u).
// Build ide preko Dockerfile-a (multi-stage: node:20 frontend + server).
import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const thoroughSurprise = service("thorough-surprise", {
    source: github("PunisaRaicevic/LDGradnja", { branch: "main", checkSuites: false }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
    },
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 30,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
    },
    replicas: { "us-west2": 1 },
  });

  return project("LDGradnja", {
    variables: { managed: false },
    resources: [thoroughSurprise],
  });
});
