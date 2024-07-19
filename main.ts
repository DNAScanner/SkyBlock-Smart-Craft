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

const enchantifyId = (id: string) => {
	if (id.includes("INGOT")) return "ENCHANTED_" + id.replace("_INGOT", "");
	else if (id.includes("ENCHANTED") && id.includes("ICE")) return "ENCHANTED_PACKED_ICE";
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
];

while (true) {
	const currentPrices = (await(await fetch("https://api.hypixel.net/skyblock/bazaar")).json() as ProductRequestResponse).products;

	const crafts = [];

	for (const baseItem of watchlist) {
		const enchantedItem = currentPrices[enchantifyId(baseItem)].product_id;
		const doubleEnchantedItem = currentPrices[enchantifyId(enchantedItem)]?.product_id || undefined;

		const baseBuyPrice = currentPrices[baseItem].sell_summary[0].pricePerUnit;
		const _baseSellPrice = currentPrices[baseItem].buy_summary[0].pricePerUnit;
		const enchantedBuyPrice = currentPrices[enchantedItem].buy_summary[0].pricePerUnit;
		const enchantedSellPrice = currentPrices[enchantedItem].sell_summary[0].pricePerUnit;
		const _doubleEnchantedBuyPrice = doubleEnchantedItem ? currentPrices[doubleEnchantedItem].buy_summary[0].pricePerUnit : 0;
		const doubleEnchantedSellPrice = doubleEnchantedItem ? currentPrices[doubleEnchantedItem].sell_summary[0].pricePerUnit : 0;

		const baseToEnchantedCraftProfit = enchantedSellPrice - baseBuyPrice * 160;
		const baseToDoubleEnchantedCraftProfit = doubleEnchantedSellPrice - baseBuyPrice * 160 * 160;
		const enchantedToDoubleEnchantedCraftProfit = doubleEnchantedSellPrice - enchantedBuyPrice * 160;

		const possibleCrafts = [
			{
				inputItem: baseItem,
				inputPrice: baseBuyPrice * 160,
				outputItem: enchantedItem,
				outputPrice: enchantedSellPrice,
				profit: baseToEnchantedCraftProfit,
				profitPercentage: baseToEnchantedCraftProfit / (baseBuyPrice * 160),
				isDoubleEnchanted: false,
			},
		];

		if (doubleEnchantedItem) {
			possibleCrafts.push(
				...[
					{
						inputItem: baseItem,
						inputPrice: baseBuyPrice * 160 * 160,
						outputItem: doubleEnchantedItem,
						outputPrice: doubleEnchantedSellPrice,
						profit: baseToDoubleEnchantedCraftProfit / 160,
						profitPercentage: baseToDoubleEnchantedCraftProfit / (baseBuyPrice * 160 * 160),
						isDoubleEnchanted: true,
					},
					{
						inputItem: enchantedItem,
						inputPrice: enchantedBuyPrice * 160 * 160,
						outputItem: doubleEnchantedItem,
						outputPrice: doubleEnchantedSellPrice,
						profit: enchantedToDoubleEnchantedCraftProfit / 160,
						profitPercentage: enchantedToDoubleEnchantedCraftProfit / (enchantedBuyPrice * 160),
						isDoubleEnchanted: true,
					},
				]
			);
		}

		crafts.push(...possibleCrafts);
	}

	const limit = 15;

	crafts.sort((a, b) => b.profit - a.profit);

	crafts.splice(limit);

	const longestInputName = Math.max(...crafts.map((craft) => formatName(craft.inputItem).length));
	const longestOutputName = Math.max(...crafts.map((craft) => formatName(craft.outputItem).length));
	const longestProfit = Math.max(...crafts.map((craft) => craft.profit.toFixed(1).length));

	console.clear();

	console.log("Best crafts:");

	for (const craftIndex in crafts) {
		// if (+craftIndex >= 15) break;
		const craft = crafts[craftIndex];
		console.log(`${+craftIndex + 1}. \x1b[5G\x1b[32m${formatName(craft.inputItem)} \x1b[0m\x1b[${longestInputName + 6}G-> \x1b[33m${formatName(craft.outputItem)} \x1b[0m\x1b[${longestInputName + longestOutputName + 10}G\x1b[32m${craft.profit.toFixed(1)}\x1b[0m \x1b[${longestInputName + longestOutputName + longestProfit + 11}G\x1b[37mhttps://bazaartracker.com/product/${craft.inputItem.toLowerCase()}\x1b[0m\n\x1b[5G\x1b[90m${craft.inputPrice.toLocaleString()} \x1b[${longestInputName + 9}G\x1b[90m${craft.outputPrice.toLocaleString()} \x1b[0m\x1b[${longestInputName + longestOutputName + 10}G\x1b[90m${craft.profitPercentage.toFixed(1)}%\x1b[0m\n`);
	}

	await new Promise((resolve) => setTimeout(resolve, 1000 * 5));
}
