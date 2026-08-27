export function TypographyStudy() {
  return (
    <div className="space-y-12">
      {/* Latin display + body */}
      <figure>
        <figcaption className="mb-3 font-mono text-[11px] tracking-[0.18em] uppercase text-faint">
          English — IBM Plex Sans · weight contrast carries hierarchy, not size
          inflation
        </figcaption>
        <p className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
          Build things that work.
        </p>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-soft">
          Every lesson ends with something you built: a prompt that works, a workflow
          that runs, an agent that saves you an hour. Reading about AI is not the skill.
          Using it is.
        </p>
      </figure>

      {/* Arabic display + body */}
      <figure>
        <figcaption className="mb-3 font-mono text-[11px] tracking-[0.18em] uppercase text-faint">
          Arabic — IBM Plex Sans Arabic · first-class, never an afterthought
        </figcaption>
        <p
          lang="ar"
          dir="rtl"
          className="text-right font-arabic text-4xl font-bold leading-[1.25] sm:text-5xl"
        >
          اتعلّم الذكاء الاصطناعي بالممارسة.
        </p>
        <p
          lang="ar"
          dir="rtl"
          className="mr-auto max-w-prose text-right font-arabic text-base leading-loose text-soft"
        >
          كل درس بينتهي بحاجة بنيتها بإيدك: برومبت شغّال، أو أتمتة بتوفر لك وقت، أو وكيل
          ذكي بيخلّص شغل مكانك. القراءة عن الذكاء الاصطناعي مش هي المهارة — الاستخدام هو
          المهارة.
        </p>
      </figure>

      {/* Mixed direction content */}
      <figure>
        <figcaption className="mb-3 font-mono text-[11px] tracking-[0.18em] uppercase text-faint">
          Mixed Arabic/English — how learners actually write and speak
        </figcaption>
        <p
          lang="ar"
          dir="rtl"
          className="mx-auto max-w-prose text-right font-arabic text-lg leading-loose"
        >
          هنبني معًا سير عمل على n8n يستقبل Webhook، يبعت البرومبت إلى Claude، ويرد
          تلقائيًا على العميل — من غير ما تكتب سطر كود واحد.
        </p>
      </figure>

      {/* Numbers & data */}
      <figure>
        <figcaption className="mb-3 font-mono text-[11px] tracking-[0.18em] uppercase text-faint">
          Numbers — Western digits everywhere (prices, stats, progress); consistent in
          both locales
        </figcaption>
        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
          <span className="text-3xl font-bold tabular-nums">82%</span>
          <span className="text-3xl font-bold tabular-nums">24</span>
          <span className="text-3xl font-bold tabular-nums">
            9<span className="text-base font-medium text-soft">h</span>
          </span>
          <span
            lang="ar"
            dir="rtl"
            className="font-arabic text-xl font-semibold tabular-nums"
          >
            الدرس 12 من 24
          </span>
        </div>
      </figure>

      {/* Technical / code */}
      <figure>
        <figcaption className="mb-3 font-mono text-[11px] tracking-[0.18em] uppercase text-faint">
          Technical terms & code — IBM Plex Mono, reserved for machinery
        </figcaption>
        <pre className="overflow-x-auto rounded-md border border-edge bg-hover px-5 py-4 font-mono text-sm leading-relaxed">
          {`POST /api/webhooks/payments   ← Paymob → EL-SHEMEY
X-Paymob-Signature: hmac-sha512
{"type": "subscription.renewed", "period_end": "2026-09-24"}`}
        </pre>
      </figure>

      {/* Scale reference */}
      <figure>
        <figcaption className="mb-3 font-mono text-[11px] tracking-[0.18em] uppercase text-faint">
          Type scale — modular, generous line-height for Arabic body text
        </figcaption>
        <ul className="divide-y divide-edge border-y border-edge">
          {[
            { cls: "text-xs", label: "xs · metadata, captions" },
            { cls: "text-sm", label: "sm · secondary copy" },
            { cls: "text-base", label: "base · body" },
            { cls: "text-xl", label: "xl · section leads" },
            { cls: "text-2xl", label: "2xl · card titles" },
            { cls: "text-4xl sm:text-5xl", label: "display · page headlines" },
          ].map((s) => (
            <li
              key={s.label}
              className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3"
            >
              <span className={`${s.cls} font-bold tracking-tight`}>Aa إلك شاي؟</span>
              <span className="ml-auto font-mono text-xs text-faint">{s.label}</span>
            </li>
          ))}
        </ul>
      </figure>
    </div>
  );
}
