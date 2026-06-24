class WheelProbability {
  static getEligibleEntries(groups) {
    if (!Array.isArray(groups)) return [];

    return groups.flatMap((group) => {
      if (!group || group.active === false || !Array.isArray(group.members)) {
        return [];
      }

      return group.members
        .filter((member) => member && member.active !== false && String(member.name || "").trim())
        .map((member) => ({
          memberId: member.id,
          groupId: group.id,
          name: String(member.name).trim(),
          groupName: String(group.name || "그룹").trim() || "그룹",
          weight: 1
        }));
    });
  }

  static getEqualOdds(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const totalWeight = list.reduce((sum, entry) => sum + WheelProbability.getWeight(entry), 0);

    return list.map((entry) => {
      const weight = WheelProbability.getWeight(entry);
      return {
        memberId: entry.memberId,
        name: entry.name,
        groupName: entry.groupName,
        weight,
        percent: totalWeight > 0 ? (weight / totalWeight) * 100 : 0
      };
    });
  }

  static pickIndex(entries, randomFn = Math.random) {
    const list = Array.isArray(entries) ? entries : [];
    const totalWeight = list.reduce((sum, entry) => sum + WheelProbability.getWeight(entry), 0);
    if (totalWeight <= 0) return -1;

    let cursor = randomFn() * totalWeight;
    for (let index = 0; index < list.length; index += 1) {
      cursor -= WheelProbability.getWeight(list[index]);
      if (cursor < 0) return index;
    }

    return list.length - 1;
  }

  static getWinnerIndexByRotation(rotationDegrees, entryCount) {
    if (!Number.isFinite(rotationDegrees) || entryCount <= 0) return -1;
    const sliceDegrees = 360 / entryCount;
    return Math.floor(WheelProbability.normalizeDegrees(-rotationDegrees) / sliceDegrees);
  }

  static normalizeDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
  }

  static getWeight(entry) {
    const weight = Number(entry && entry.weight);
    return Number.isFinite(weight) && weight > 0 ? weight : 1;
  }
}

globalThis.WheelProbability = WheelProbability;
