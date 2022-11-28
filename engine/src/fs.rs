use anyhow::Result;
use brotli::CompressorWriter;
use brotli::Decompressor;
use std::fs::OpenOptions;
use std::io::Read;
use std::io::Write;

pub fn bytes_to_file_compress(bytes: Vec<u8>, loc: String, compress: bool) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(loc)?;

    if compress {
        let mut brotli_file = CompressorWriter::new(&mut file, 4096, 5 as u32, 21 as u32);
        brotli_file.write_all(&bytes).map_err(anyhow::Error::msg)
    } else {
        file.write_all(&bytes).map_err(anyhow::Error::msg)
    }
}

pub fn file_to_bytes_decompress(loc: String, decompress: bool) -> Option<Vec<u8>> {
    let mut file = OpenOptions::new().read(true).open(loc).ok()?;

    let mut bytes = Vec::new();
    if decompress {
        let mut brotli_file = Decompressor::new(&mut file, 4096);
        brotli_file.read_to_end(&mut bytes).ok()?;
    } else {
        file.read_to_end(&mut bytes).ok()?;
    }

    Some(bytes)
}

#[inline]
pub fn file_to_bytes(loc: String) -> Option<Vec<u8>> {
    file_to_bytes_decompress(loc, false)
}
