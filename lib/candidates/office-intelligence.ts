export type OfficeIntelligence = {
  label: string;
  whatOfficeDoes: string;
  powers: string[];
  votersShouldLookFor: string[];
  typicalIssues: string[];
  questionsToAsk: string[];
  sourceNote: string;
};

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function getOfficeIntelligence(officeTitle?: string | null, jurisdictionName?: string | null): OfficeIntelligence {
  const office = (officeTitle ?? "").toLowerCase();
  const jurisdiction = jurisdictionName ?? "this jurisdiction";
  const sourceNote =
    "Office context is a general civic explainer based on the office/race type and stored race metadata. It is not a candidate biography or endorsement.";

  if (includesAny(office, ["municipal court", "justice court", "judge", "court"])) {
    const isMunicipal = office.includes("municipal");
    const courtType = isMunicipal ? "municipal court judges" : office.includes("justice") ? "justice court judges" : "judges";
    return {
      label: officeTitle ?? "Judicial office",
      whatOfficeDoes: `${courtType.charAt(0).toUpperCase()}${courtType.slice(1)} preside over cases assigned to their court, apply court rules, make rulings, and manage courtroom proceedings. The exact caseload depends on the court and department.`,
      powers: [
        "Hear and decide cases assigned to the court.",
        "Rule on motions, evidence, hearings, and courtroom procedure.",
        "Set or apply penalties, orders, or case outcomes allowed by law.",
        isMunicipal ? "Handle city-level matters such as traffic, misdemeanor, and ordinance cases where applicable." : "Handle matters within the court's statutory jurisdiction.",
      ],
      votersShouldLookFor: [
        "Legal experience and courtroom temperament.",
        "Fairness, independence, and respect for due process.",
        "Administrative competence and ability to manage case flow.",
        "Clear public record, qualifications, and any professional discipline history.",
      ],
      typicalIssues: ["Public safety", "Traffic and misdemeanor cases", "Court access", "Case backlogs", "Procedural fairness"],
      questionsToAsk: [
        "What courtroom or judicial experience does this candidate have?",
        "How does the candidate describe fairness, access, and due process?",
        "Are there public evaluations, endorsements, or disciplinary records to review?",
      ],
      sourceNote,
    };
  }

  if (includesAny(office, ["school board", "trustee", "board of education"])) {
    return {
      label: officeTitle ?? "School board office",
      whatOfficeDoes: `School board members govern the public school district serving ${jurisdiction}. They set district policy, approve budgets, hire or oversee the superintendent, and make decisions that shape local schools.`,
      powers: [
        "Approve school district budgets and major spending decisions.",
        "Set district policies and academic priorities.",
        "Oversee the superintendent and district administration.",
        "Represent families, students, and staff in district decisions.",
      ],
      votersShouldLookFor: [
        "Understanding of local school needs and student outcomes.",
        "Budget literacy and transparency.",
        "Approach to safety, staffing, curriculum, and parent/community communication.",
        "Ability to work in public meetings and govern collaboratively.",
      ],
      typicalIssues: ["Student achievement", "School safety", "Teacher staffing", "Facilities", "Budget priorities", "Transportation"],
      questionsToAsk: [
        "What evidence does the candidate provide for their education priorities?",
        "How would they handle tradeoffs in the district budget?",
        "How do they plan to listen to students, families, educators, and staff?",
      ],
      sourceNote,
    };
  }

  if (includesAny(office, ["city council", "councilmember", "council member", "mayor"])) {
    return {
      label: officeTitle ?? "City office",
      whatOfficeDoes: `City elected officials help govern ${jurisdiction}. They set local policy, approve budgets, oversee city services, and make decisions about development, public safety, transportation, and neighborhood priorities.`,
      powers: [
        "Adopt ordinances and local policies.",
        "Approve city budgets, fees, contracts, and major projects.",
        "Oversee city services and executive priorities.",
        "Represent residents in public meetings and local decision-making.",
      ],
      votersShouldLookFor: [
        "Knowledge of neighborhood needs and city finances.",
        "Specific positions on housing, safety, growth, and infrastructure.",
        "Transparency around donors, endorsements, and conflicts of interest.",
        "Track record of listening to residents and explaining votes.",
      ],
      typicalIssues: ["Housing", "Public safety", "Roads and transit", "Development", "Parks", "Homelessness", "City budget"],
      questionsToAsk: [
        "What local problems does the candidate prioritize first?",
        "How would they balance growth, affordability, and infrastructure?",
        "Which city votes, projects, or policies are most relevant to this race?",
      ],
      sourceNote,
    };
  }

  if (includesAny(office, ["county commission", "commissioner", "county supervisor"])) {
    return {
      label: officeTitle ?? "County office",
      whatOfficeDoes: `County commissioners govern county services for ${jurisdiction}. They approve county budgets, land-use decisions, public health and safety priorities, and regional services that often cross city boundaries.`,
      powers: [
        "Approve county budgets, contracts, and service priorities.",
        "Make land-use and regional planning decisions where applicable.",
        "Oversee county departments and public services.",
        "Represent district residents in county-level decisions.",
      ],
      votersShouldLookFor: [
        "County budget and land-use knowledge.",
        "Positions on public health, safety, roads, housing, and growth.",
        "District-specific understanding and responsiveness.",
        "Source-backed record of public service or civic experience.",
      ],
      typicalIssues: ["Regional planning", "Public health", "Roads", "Jails and public safety", "Housing", "County services"],
      questionsToAsk: [
        "Which county services does this candidate want to improve?",
        "How would they approach regional growth and land-use decisions?",
        "What district needs are different from the county overall?",
      ],
      sourceNote,
    };
  }

  if (includesAny(office, ["assembly", "senate", "legislature", "legislative"])) {
    return {
      label: officeTitle ?? "State legislative office",
      whatOfficeDoes: `State legislators write and vote on state laws, approve state budgets, and represent their district at the Nevada Legislature.`,
      powers: [
        "Introduce, amend, and vote on legislation.",
        "Approve state budgets and agency funding.",
        "Serve on committees and hold hearings.",
        "Help constituents navigate state government issues.",
      ],
      votersShouldLookFor: [
        "Clear positions on state policy issues.",
        "Legislative priorities and committee interests.",
        "Evidence of coalition-building and constituent service.",
        "Transparency around donors, endorsements, and public statements.",
      ],
      typicalIssues: ["Education", "Housing", "Taxes and budget", "Health care", "Public safety", "Water", "Jobs"],
      questionsToAsk: [
        "What bills or policy areas would this candidate prioritize?",
        "How would they represent district interests at the state level?",
        "What evidence supports their stated issue positions?",
      ],
      sourceNote,
    };
  }

  if (includesAny(office, ["congress", "representative", "u.s.", "us senate", "united states senate"])) {
    return {
      label: officeTitle ?? "Federal office",
      whatOfficeDoes: `Federal elected officials represent Nevada residents in Congress, vote on national legislation, oversee federal agencies, and shape federal budgets and programs.`,
      powers: [
        "Introduce and vote on federal legislation.",
        "Approve federal budgets, taxes, and spending.",
        "Conduct oversight of federal agencies.",
        "Help constituents with federal services and casework.",
      ],
      votersShouldLookFor: [
        "Positions on national issues with Nevada impacts.",
        "Committee interests, experience, and constituent service record.",
        "Campaign finance transparency and major endorsements.",
        "Evidence of public statements, votes, or policy proposals.",
      ],
      typicalIssues: ["Federal budget", "Health care", "Immigration", "Defense", "Public lands", "Water", "Jobs"],
      questionsToAsk: [
        "How would this candidate represent Nevada in federal decisions?",
        "What federal programs or agencies matter most to this race?",
        "Which public statements or votes support their positions?",
      ],
      sourceNote,
    };
  }

  if (includesAny(office, ["governor", "attorney general", "secretary of state", "treasurer", "controller", "lieutenant governor"])) {
    return {
      label: officeTitle ?? "Statewide executive office",
      whatOfficeDoes: `Statewide executive officials administer major parts of Nevada government. Their responsibilities vary by office, but they often set statewide priorities, manage public agencies, enforce laws, or oversee elections and financial functions.`,
      powers: [
        "Administer statewide government responsibilities assigned to the office.",
        "Set executive priorities, policies, or enforcement approaches where applicable.",
        "Manage public resources, records, elections, legal functions, or finances depending on the office.",
        "Represent Nevada residents in statewide decisions.",
      ],
      votersShouldLookFor: [
        "Relevant executive, legal, administrative, or policy experience.",
        "Specific plans for the office's statutory responsibilities.",
        "Transparency around conflicts, donors, and public record.",
        "Evidence of competence managing people, budgets, and public systems.",
      ],
      typicalIssues: ["State administration", "Elections", "Consumer protection", "Budget", "Public records", "Economic development"],
      questionsToAsk: [
        "What powers does this specific statewide office have?",
        "What public record shows the candidate can administer the office?",
        "What would change in the office if this candidate wins?",
      ],
      sourceNote,
    };
  }

  return {
    label: officeTitle ?? "Office/race",
    whatOfficeDoes: `This race is for an office connected to ${jurisdiction}. Core filing and race facts are available, but a more specific office explainer has not been classified yet.`,
    powers: [
      "Exercise the legal duties assigned to the office.",
      "Represent the jurisdiction or district identified in the election record.",
      "Make or administer public decisions within the office's authority.",
    ],
    votersShouldLookFor: [
      "Official duties and decision-making power of the office.",
      "Candidate qualifications and source-backed public statements.",
      "Campaign website, finance records, endorsements, and public record.",
      "How the candidate would handle issues commonly connected to the office.",
    ],
    typicalIssues: ["Public budget", "Service delivery", "Transparency", "Accountability", "Constituent responsiveness"],
    questionsToAsk: [
      "What does this office actually control?",
      "What source-backed information is available about the candidate?",
      "Who else is running for the same office or department?",
    ],
    sourceNote,
  };
}
