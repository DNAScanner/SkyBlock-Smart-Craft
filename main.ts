type Product = {
	product_id: string;
	sell_summary: {
		amount: number;
		pricePerUnit: number;
		orders: number;
	}[];
	buy_summary: {
		amount: number;
		pricePerUnit: number;
		orders: number;
	}[];
	quick_status: {
		productId: string;
		sellPrice: number;
		sellVolume: number;
		sellMovingWeek: number;
		sellOrders: number;
		buyPrice: number;
		buyVolume: number;
		buyMovingWeek: number;
		buyOrders: number;
	};
};

type ProductRequestResponse = {
	success: true;
	lastUpdated: number;
	products: Record<string, Product>;
};

type Craft = {
	inputItem: string;
	inputPrice: number;
	inputAmount: number;
	outputItem: string;
	outputPrice: number;
	sellVolume?: number;
	profit: number;
	profitPerOrder?: number;
	profitPercentage: number;
	isDoubleEnchanted: boolean;
};

console.log("\x1b[?1049hFetching resources...");

for (const signal of ["SIGBREAK", "SIGINT"] as Deno.Signal[]) {
	Deno.addSignalListener(signal, () => {
		console.log("\x1b[?1049l");
		Deno.exit();
	});
}

const formatName = (name: string) =>
	name
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");

const shortenNumber = (number: number) => {
	if (number >= 1_000_000_000) return (number / 1_000_000_000).toFixed(1) + "B";
	if (number >= 1_000_000) return (number / 1_000_000).toFixed(1) + "M";
	if (number >= 1_000) return (number / 1_000).toFixed(1) + "K";
	return number.toFixed(1);
};

const enchantifyId = (id: string) => {
	if (id.includes("INGOT")) return "ENCHANTED_" + id.replace("_INGOT", "");
	else if (id.includes("ENCHANTED") && id.includes("ICE")) return "ENCHANTED_PACKED_ICE";
	else if (id.includes("ENCHANTED") && id.includes("BALL")) return "ENCHANTED_SLIME_BLOCK";
	else if (id.includes("ENCHANTED") && id.includes("CREAM")) return "WHIPPED_MAGMA_CREAM";
	else if (!id.includes("ENCHANTED") && id.includes("BLAZE_ROD")) return "ENCHANTED_BLAZE_POWDER";
	else if (id.includes("ENCHANTED") && id.includes("POWDER")) return "ENCHANTED_BLAZE_ROD";
	else if (id.includes("ENCHANTED") && !id.includes("BLOCK")) return id + "_BLOCK";
	else return "ENCHANTED_" + id;
};

const watchlist = [
	//
	"COBBLESTONE",
	"COAL",
	"IRON_INGOT",
	"GOLD_INGOT",
	"DIAMOND",
	"EMERALD",
	"REDSTONE",
	"OBSIDIAN",
	"SAND",
	"ICE",
	"SNOW_BLOCK",
	"ROTTEN_FLESH",
	"BONE",
	"STRING",
	"GHAST_TEAR",
	"SLIME_BALL",
	"MAGMA_CREAM",
	"BLAZE_ROD",
];

while (true) {
	const currentPrices = (await(await fetch("https://api.hypixel.net/skyblock/bazaar")).json() as ProductRequestResponse).products;

	const crafts: Craft[] = [];

	for (const baseItem of watchlist) {
		const enchantedItem = currentPrices[enchantifyId(baseItem)].product_id;
		const doubleEnchantedItem = currentPrices[enchantifyId(enchantedItem)]?.product_id || undefined;

		const baseBuyPrice = currentPrices[baseItem].sell_summary[0].pricePerUnit;
		const baseSellPrice = currentPrices[baseItem].buy_summary[0].pricePerUnit;
		const enchantedBuyPrice = currentPrices[enchantedItem].buy_summary[0].pricePerUnit;
		const enchantedSellPrice = currentPrices[enchantedItem].sell_summary[0].pricePerUnit;
		const doubleEnchantedBuyPrice = doubleEnchantedItem ? currentPrices[doubleEnchantedItem].buy_summary[0].pricePerUnit : 0;
		const doubleEnchantedSellPrice = doubleEnchantedItem ? currentPrices[doubleEnchantedItem].sell_summary[0].pricePerUnit : 0;

		const baseToEnchantedCraftProfit = enchantedSellPrice - baseBuyPrice * 160;
		const baseToDoubleEnchantedCraftProfit = doubleEnchantedSellPrice - baseBuyPrice * 160 * 160;
		const enchantedToDoubleEnchantedCraftProfit = doubleEnchantedSellPrice - enchantedBuyPrice * 160;

		const possibleCrafts: Craft[] = [
			{
				inputItem: baseItem,
				inputPrice: Math.min(baseBuyPrice, baseSellPrice) * 160,
				inputAmount: 160,
				outputItem: enchantedItem,
				outputPrice: Math.max(enchantedSellPrice, enchantedBuyPrice),
				profit: baseToEnchantedCraftProfit,
				profitPercentage: baseToEnchantedCraftProfit / (baseBuyPrice * 160),
				isDoubleEnchanted: false,
			},
		];

		if (doubleEnchantedItem) {
			possibleCrafts.push(
				{
					inputItem: baseItem,
					inputPrice: Math.min(baseBuyPrice, baseSellPrice) * 160 * 160,
					inputAmount: 160 * 160,
					outputItem: doubleEnchantedItem,
					outputPrice: Math.max(doubleEnchantedSellPrice, doubleEnchantedBuyPrice),
					profit: baseToDoubleEnchantedCraftProfit / 160,
					profitPercentage: baseToDoubleEnchantedCraftProfit / (baseBuyPrice * 160 * 160),
					isDoubleEnchanted: true,
				},
				{
					inputItem: enchantedItem,
					inputPrice: Math.min(enchantedBuyPrice, enchantedSellPrice) * 160 * 160,
					inputAmount: 160,
					outputItem: doubleEnchantedItem,
					outputPrice: Math.max(doubleEnchantedSellPrice, doubleEnchantedBuyPrice),
					profit: enchantedToDoubleEnchantedCraftProfit / 160,
					profitPercentage: enchantedToDoubleEnchantedCraftProfit / (enchantedBuyPrice * 160),
					isDoubleEnchanted: true,
				}
			);
		}

		possibleCrafts.map((craft) => (craft.sellVolume = currentPrices[craft.inputItem].quick_status.sellVolume));

		possibleCrafts.map((craft) => (craft.profitPerOrder = craft.profit * (71860 / craft.inputAmount)));

		crafts.push(...possibleCrafts);
	}

	const limit = 15;

	crafts.sort((a, b) => (b.profitPerOrder || 0) - (a.profitPerOrder || 0));

	crafts.splice(limit);

	const longestInputName = Math.max(...crafts.map((craft) => formatName(craft.inputItem).length));
	const longestOutputName = Math.max(...crafts.map((craft) => formatName(craft.outputItem).length));
	const longestProfit = Math.max(...crafts.map((craft) => craft.profit.toFixed(1).length));

	console.clear();

	console.log("Best crafts:");

	for (const craftIndex in crafts) {
		const craft = crafts[craftIndex];
		// console.log(`${+craftIndex + 1}. \x1b[5G\x1b[32m\x1b]8;;https://bazaartracker.com/product/${craft.inputItem.toLowerCase()}\x1b\\${formatName(craft.inputItem)}\x1b]8;;\x1b\\ \x1b[0m\x1b[${longestInputName + 6}G-> \x1b[33m\x1b]8;;https://bazaartracker.com/product/${craft.outputItem.toLowerCase()}\x1b\\${formatName(craft.outputItem)}\x1b]8;;\x1b\\ \x1b[0m\x1b[${longestInputName + longestOutputName + 10}G\x1b[32m${craft.profit.toFixed(1)}\x1b[0m \x1b[${longestInputName + longestOutputName + longestProfit + 12}G\x1b[33m${shortenNumber(craft.profitPerOrder || 0)} \x1b[0mper order\n\x1b[5G\x1b[90m${craft.inputPrice.toLocaleString()} \x1b[${longestInputName + 9}G\x1b[90m${craft.outputPrice.toLocaleString()} \x1b[0m\x1b[${longestInputName + longestOutputName + 10}G\x1b[90m${shortenNumber(craft.sellVolume || 0)}\x1b[0m\n`);

		console.log(
			[
				`${+craftIndex + 1}. `, //                                                                                                                        Index
				`\x1b[5G\x1b[32m\x1b]8;;https://bazaartracker.com/product/${craft.inputItem.toLowerCase()}\x1b\\${formatName(craft.inputItem)}\x1b]8;;\x1b\\`, // Input item
				`\x1b[0m\x1b[${longestInputName + 6}G-> `, //                                                                                                     Arrow
				`\x1b[33m\x1b]8;;https://bazaartracker.com/product/${craft.outputItem.toLowerCase()}\x1b\\${formatName(craft.outputItem)}\x1b]8;;\x1b\\`, //      Output item
				`\x1b[0m\x1b[${longestInputName + longestOutputName + 11}G`, //                                                                                   Spacing
				`\x1b[32m${craft.profit.toFixed(1)}`, //                                                                                                          Profit
				`\x1b[0m\x1b[${longestInputName + longestOutputName + longestProfit + 13}G`, //                                                                   Spacing
				`\x1b[33m${shortenNumber(craft.profitPerOrder || 0)} `, //                                                                                        Profit per order
				`\x1b[0mper order\n`, //                                                                                                                          profit per order text + new line
				`\x1b[5G\x1b[90m${craft.inputPrice.toLocaleString()}`, //                                                                                         Input price
				`\x1b[${longestInputName + 9}G\x1b[90m${craft.outputPrice.toLocaleString()}`, //                                                                  Output price
				`\x1b[0m\x1b[${longestInputName + longestOutputName + 11}G`, //                                                                                   Spacing
				`\x1b[90m${shortenNumber(craft.sellVolume || 0)}`, //                                                                                             Sell volume
				`\x1b[0m\n`, //                                                                                                                                   Empty line to next craft
			].join("")
		);
	}

	await new Promise((resolve) => setTimeout(resolve, 1000 * 5));
}
