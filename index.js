import { fileURLToPath } from 'url';
import { dirname } from 'path';
import express from 'express';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 80;
app.use("/", express.static(`${__dirname}/app`))
app.use("/data", express.static(`${__dirname}/data`));
app.listen(port, () => console.log(`Server running at http${port == 443 ? "s" : ""}://localhost${(port == 80 || port == 443) ? "" : `:${port}`}`));