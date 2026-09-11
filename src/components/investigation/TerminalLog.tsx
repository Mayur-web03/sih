import { useEffect, useRef } from "react";

export function TerminalLog({ lines }: { lines: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="terminal-panel">
      {lines.map((line, i) => (
        <div className="terminal-line" key={i}>
          <span className="terminal-prompt">$</span> {line}
        </div>
      ))}
      <span className="terminal-cursor" />
      <div ref={endRef} />
    </div>
  );
}