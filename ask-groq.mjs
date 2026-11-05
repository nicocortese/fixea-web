import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();
const apiKey = process.env.GROQ_API_KEY;


async function main() {
  const userPrompt = process.argv.slice(2).join(" ");
  
  if (!userPrompt) {
    console.error("❌ Faltó la instrucción. Ej: node ask-groq.mjs 'arreglá el modal'");
    process.exit(1);
  }

  console.log("🤖 Pensando la solución...");

  try {
    const completion = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: `Sos un Senior Fullstack experto en Next.js 16, React, Tailwind y MongoDB. 
Contexto: Estamos haciendo "Fixea", un SaaS de feedback visual con una extensión de Chrome híbrida.
Reglas estrictas:
1. Devolvé código limpio, directo y listo para pegar. No des explicaciones largas.
2. NO alteres ni toques ningún archivo de la extensión de Chrome (carpetas /extension o /dist-extension) ni la lógica del endpoint /api/projects/match.
3. El rol 'Cliente' debe poder crear proyectos y cargar el 'targetUrl' (URL objetivo) de su sitio web para que la extensión funcione.
4. Asegurate de que los modelos de MongoDB guarden status: 'active' y el targetUrl.`
        },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
    });

    console.log("\n--- CÓDIGO DE GROQ ---\n");
    console.log(completion.choices[0]?.message?.content || "Sin respuesta");
    console.log("\n----------------------\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}
main();