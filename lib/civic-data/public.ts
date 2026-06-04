import { prisma } from "@/lib/prisma";

export type PublicOfficialRow = {
  id: string;
  fullName: string;
  partyText: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
  status: string;
  termStart: Date | null;
  termEnd: Date | null;
  office: {
    title: string;
    level: string;
  };
  jurisdiction: {
    name: string;
    slug: string;
    type: string;
  };
  district: {
    name: string;
    type: string;
  } | null;
  source: {
    name: string;
    url: string;
  } | null;
};

export async function getPublicOfficials(jurisdictionSlug?: string): Promise<PublicOfficialRow[]> {
  const officials = await prisma.official.findMany({
    where: jurisdictionSlug
      ? {
          jurisdiction: {
            slug: jurisdictionSlug,
          },
        }
      : undefined,
    include: {
      office: {
        select: {
          title: true,
          level: true,
        },
      },
      jurisdiction: {
        select: {
          name: true,
          slug: true,
          type: true,
        },
      },
      district: {
        select: {
          name: true,
          districtType: true,
        },
      },
      source: {
        select: {
          name: true,
          url: true,
        },
      },
    },
    orderBy: [{ jurisdiction: { name: "asc" } }, { office: { level: "asc" } }, { fullName: "asc" }],
    take: 250,
  });

  return officials.map((official) => ({
    id: official.id,
    fullName: official.fullName,
    partyText: official.partyText,
    email: official.email,
    phone: official.phone,
    websiteUrl: official.websiteUrl,
    photoUrl: official.photoUrl,
    status: official.status,
    termStart: official.termStart,
    termEnd: official.termEnd,
    office: {
      title: official.office.title,
      level: official.office.level,
    },
    jurisdiction: {
      name: official.jurisdiction.name,
      slug: official.jurisdiction.slug,
      type: official.jurisdiction.type,
    },
    district: official.district
      ? {
          name: official.district.name,
          type: official.district.districtType,
        }
      : null,
    source: official.source,
  }));
}

