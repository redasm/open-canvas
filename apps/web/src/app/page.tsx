"use client";

import { Canvas } from "@/components/canvas";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { GraphProvider } from "@/contexts/GraphContext";
import { ThreadProvider } from "@/contexts/ThreadProvider";
import { UserProvider } from "@/contexts/UserContext";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { Suspense } from "react";

export default function Home() {
  return (
    <ErrorBoundary componentName="HomePage">
      <Suspense>
        <UserProvider>
          <ErrorBoundary componentName="UserProvider">
            <ThreadProvider>
              <ErrorBoundary componentName="ThreadProvider">
                <AssistantProvider>
                  <ErrorBoundary componentName="AssistantProvider">
                    <GraphProvider>
                      <ErrorBoundary componentName="GraphProvider">
                        <Canvas />
                      </ErrorBoundary>
                    </GraphProvider>
                  </ErrorBoundary>
                </AssistantProvider>
              </ErrorBoundary>
            </ThreadProvider>
          </ErrorBoundary>
        </UserProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
