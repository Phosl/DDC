"use client";

import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

export function HomeMotion() {
  useGSAP(() => {
    const home = document.querySelector<HTMLElement>("[data-home]");

    if (!home) return;

    const media = gsap.matchMedia();

    media.add(
      {
        animated: "(prefers-reduced-motion: no-preference)",
        reduced: "(prefers-reduced-motion: reduce)",
        desktop: "(min-width: 769px)",
      },
      (context) => {
        const { animated, reduced, desktop } = context.conditions ?? {};
        const revealItems = gsap.utils.toArray<HTMLElement>("[data-reveal]", home);

        if (reduced) {
          gsap.set(revealItems, { clearProps: "all", opacity: 1, y: 0 });
          return;
        }

        if (!animated) return;

        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro
          .from("[data-hero-image]", { scale: 1.12, duration: 1.45 })
          .from(
            "[data-hero-line]",
            { yPercent: 110, duration: 1.05, stagger: 0.09 },
            0.16,
          )
          .from("[data-hero-meta]", { opacity: 0, y: 18, duration: 0.75 }, 0.58);

        revealItems.forEach((element) => {
          gsap.from(element, {
            opacity: 0,
            y: 56,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 84%",
              once: true,
            },
          });
        });

        gsap.to("[data-progress-line]", {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: home,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.3,
          },
        });

        gsap.utils.toArray<HTMLElement>("[data-chapter-image]", home).forEach((image) => {
          gsap.fromTo(
            image,
            { clipPath: "inset(14% 0 14% 0)", scale: 1.08 },
            {
              clipPath: "inset(0% 0 0% 0)",
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: image,
                start: "top 88%",
                end: "bottom 58%",
                scrub: true,
              },
            },
          );
        });

        if (desktop) {
          gsap.to("[data-orbit='outer']", {
            rotate: 110,
            scale: 1.18,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-manifesto]",
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          });

          gsap.to("[data-hero-image]", {
            yPercent: 10,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-hero]",
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          });
        }
      },
    );

    ScrollTrigger.refresh();
    return () => media.revert();
  }, []);

  return null;
}
