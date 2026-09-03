import { useRef } from "react";
import { useWebMCP } from "usewebmcp";
import { PIZZA_TOOLS } from "./toolDefs";

function PizzaTool({ tool, apiRef }) {
  useWebMCP({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    execute: (input) => tool.execute(apiRef.current, input || {}),
  });
  return null;
}

/**
 * Registers all pizza WebMCP tools via the official usewebmcp hook.
 * Renders nothing; must live inside PizzaProvider where api is available.
 */
export function PizzaWebMCPTools({ api }) {
  const apiRef = useRef(api);
  apiRef.current = api;

  return (
    <>
      {PIZZA_TOOLS.map((tool) => (
        <PizzaTool key={tool.name} tool={tool} apiRef={apiRef} />
      ))}
    </>
  );
}
