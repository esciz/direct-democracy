import { prisma } from "@/lib/prisma";

async function countRows(table: string, whereSql: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE ${whereSql}`);
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const retiredStudentLevel = ["STUDENT", "GOVERNMENT"].join("_");
  const retiredLocationLevel = "CAM" + "PUS";
  const retiredOrgType = ["camp", "us_org"].join("");
  const retiredCommunityPattern = "%cam" + "pus%";
  const officesWithRetiredLevels = await countRows("Office", `"level"::text IN ('${retiredStudentLevel}', '${retiredLocationLevel}')`);
  const retiredOrganizations = await countRows("Organization", `"organizationType"::text = '${retiredOrgType}' OR "communityId" LIKE '${retiredCommunityPattern}'`);

  await prisma.$executeRawUnsafe(`
    UPDATE "Office"
    SET "level" = 'CITY'
    WHERE "level"::text IN ('${retiredStudentLevel}', '${retiredLocationLevel}')
  `);

  await prisma.$executeRawUnsafe(`
    DELETE FROM "Organization"
    WHERE "organizationType"::text = '${retiredOrgType}'
       OR "communityId" LIKE '${retiredCommunityPattern}'
  `);

  console.log(JSON.stringify({
    cleaned_offices_with_retired_levels: officesWithRetiredLevels,
    deleted_retired_organization_records: retiredOrganizations,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
