import { CopilotClient, defineTool, approveAll } from "@github/copilot-sdk";
import * as readline from "readline";

const getWeather = defineTool("get_weather", {
    description: "Get the current weather for a city",
    parameters: {
        type: "object",
        properties: {
            city: { type: "string", description: "The city name" },
        },
        required: ["city"],
    },
    handler: async ({ city }: { city: string }) => {
        const conditions = ["sunny", "cloudy", "rainy", "partly cloudy"];
        const temp = Math.floor(Math.random() * 30) + 50;
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        return { city, temperature: `${temp}°F`, condition };
    },
});

const client = new CopilotClient({
	cliUrl: "localhost:4321"
});

await client.start();

const session = await client.resumeSession({
    model: "gpt-4.1",
    streaming: true,
    sessionId: "WeatherConvo",
    tools: [getWeather],
    onPermissionRequest: approveAll,
});


/*const session = await client.createSession({
    model: "gpt-4.1",
    streaming: true,
    sessionId: "WeatherConvo",
    tools: [getWeather],
    onPermissionRequest: approveAll,
});
*/
session.on("assistant.message_delta", (event) => {
    process.stdout.write(event.data.deltaContent);
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log("🌤️  Weather Assistant (type 'exit' to quit)");
console.log("   Try: 'What's the weather in Paris?'\n");

const prompt = () => {
    rl.question("You: ", async (input) => {
        if (input.toLowerCase() === "exit") {
            console.log(session.sessionId);
            await session.destroy();
            await client.stop();
            rl.close();
            return;
        }

        process.stdout.write("Assistant: ");
        await session.sendAndWait({ prompt: input });
        console.log("\n");
        prompt();
    });
};

prompt();
