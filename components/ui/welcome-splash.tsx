"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const STORAGE_KEY = "alamirms_welcome_seen_v1";

export function WelcomeSplash() {
  const [visible, setVisible] = useState(false);
  const [exit, setExit] = useState(false);

  useEffect(() => {
    const seen = window.localStorage.getItem(STORAGE_KEY) === "1";
    if (seen) return;

    const showTimer = window.setTimeout(() => setVisible(true), 0);
    const exitTimer = window.setTimeout(() => setExit(true), 1850);
    const hideTimer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
    }, 2350);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`welcome-splash ${exit ? "welcome-splash-out" : ""}`}>
      <div className="welcome-splash-glow" />
      <div className="welcome-splash-logo-wrap">
        <Image
          src="/logotransparentbackground.svg"
          alt="Alamirms logo"
          width={176}
          height={176}
          className="welcome-splash-logo"
          priority
        />
        <p className="welcome-splash-text">AlamIrms</p>
      </div>
    </div>
  );
}
