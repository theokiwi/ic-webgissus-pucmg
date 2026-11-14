"""Baixa as fontes externas que faltam em data/raw/ (idempotente) e registra a URL de cada uma.

Uso: pipelines/run.sh etl/baixar.py [AAAAMM]

Registro: data/raw/fontes.json  ->  {nome: {url, arquivo, bytes, baixado_em}}
O ETL (carga.py) lê esse registro para preencher `carga.fontes`.

CNES e base territorial (DATASUS) são grandes/FTP e foram baixados à mão; só registramos
de onde vêm. Já a malha municipal, o Censo 2022 e os setores são baixados aqui.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAW = Path("data/raw")
REGISTRO = RAW / "fontes.json"

IBGE_FTP = "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022"
GEOFTP = "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais"

# SIDRA tabela 4714 (Censo 2022): v93 = população residente, v6318 = área (km²), v614 = densidade.
# n6 = município; "in n3 31" = municípios da UF 31 (MG).
SIDRA_URL = "https://apisidra.ibge.gov.br/values/t/4714/n6/in%20n3%2031/v/93,6318/p/2022"
SIDRA_ARQ = "censo2022_municipios_mg.json"
SETORES_MALHA_URL = f"{GEOFTP}/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/setores/shp/UF/MG_setores_CD2022.zip"
SETORES_BASICO_URL = f"{IBGE_FTP}/Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/Agregados_por_setores_basico_BR_20260520.zip"
MALHA_MUN_URL = f"{GEOFTP}/malhas_municipais/municipio_2024/UFs/MG/MG_Municipios_2024.zip"


def fontes(comp: str) -> dict[str, tuple[str, Path | None]]:
    """nome -> (url, arquivo local). Arquivo None = só registro (baixado fora daqui)."""
    return {
        "cnes": (f"ftp://ftp.datasus.gov.br/cnes/BASE_DE_DADOS_CNES_{comp}.ZIP",
                 RAW / "cnes" / f"BASE_DE_DADOS_CNES_{comp}.ZIP"),
        "territorio": ("ftp://ftp.datasus.gov.br/territorio/tabelas/2026/06-base_territorial_jun26.zip",
                       RAW / "territorio" / "06-base_territorial_jun26.zip"),
        "ibge_malha_municipios": (MALHA_MUN_URL, RAW / "ibge" / "MG_Municipios_2024.zip"),
        "ibge_censo2022_municipios": (SIDRA_URL, RAW / "ibge" / SIDRA_ARQ),
        "ibge_setores_malha": (SETORES_MALHA_URL, RAW / "ibge" / "MG_setores_CD2022.zip"),
        "ibge_setores_basico": (SETORES_BASICO_URL, RAW / "ibge" / "Agregados_por_setores_basico_BR_20260520.zip"),
    }


def baixar(url: str, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(destino.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "webgissus-etl/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, tmp.open("wb") as f:
        while bloco := r.read(1 << 20):
            f.write(bloco)
    tmp.rename(destino)


def main() -> None:
    comp = sys.argv[1] if len(sys.argv) > 1 else "202609"
    registro = json.loads(REGISTRO.read_text()) if REGISTRO.exists() else {}
    for nome, (url, arq) in fontes(comp).items():
        if arq is not None and not arq.exists():
            if url.startswith("ftp://"):
                raise SystemExit(f"falta {arq} (fonte DATASUS, baixar à mão de {url})")
            print(f"baixando {nome}: {url}", flush=True)
            baixar(url, arq)
        elif arq is not None:
            print(f"ok (já existe) {arq}")
        registro[nome] = {
            "url": url,
            "arquivo": str(arq),
            "bytes": arq.stat().st_size,
            "registrado_em": registro.get(nome, {}).get("registrado_em")
            or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
    REGISTRO.write_text(json.dumps(registro, indent=2, ensure_ascii=False))
    print(f"registro em {REGISTRO}")


if __name__ == "__main__":
    main()
