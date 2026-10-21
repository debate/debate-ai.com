import { Link, Section, Text } from "@react-email/components";
import { colors } from "./EmailLayout";

export interface EmailFeature {
  /** Short feature name, linked to `href`. */
  title: string;
  /** One line on what it does. */
  description: string;
  /** Absolute link to the feature on the site. */
  href: string;
}

/** A linked, described list of site features, one per row. */
export function FeatureList({ features }: { features: EmailFeature[] }) {
  return (
    <Section style={{ margin: "8px 0 4px" }}>
      {features.map((feature) => (
        <Section key={feature.title} style={{ margin: "0 0 14px" }}>
          <Text style={{ fontSize: "15px", fontWeight: 600, lineHeight: "22px", margin: 0 }}>
            <Link href={feature.href} style={{ color: colors.accent, textDecoration: "none" }}>
              {feature.title}
            </Link>
          </Text>
          <Text style={{ color: colors.muted, fontSize: "14px", lineHeight: "21px", margin: 0 }}>
            {feature.description}
          </Text>
        </Section>
      ))}
    </Section>
  );
}
