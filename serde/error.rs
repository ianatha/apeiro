// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
use std::fmt::{self, Display};

extern crate serde;
use self::serde::{de, ser};

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Clone, Debug, Eq, PartialEq)]
#[non_exhaustive]
pub enum Error {
    Message(String),

    ExpectedBoolean,
    ExpectedInteger,
    ExpectedNumber,
    ExpectedString,
    ExpectedArray,
    ExpectedMap,
    ExpectedEnum,
    ExpectedObject,
    ExpectedBuffer,
    ExpectedDetachable,

    ExpectedUtf8,
    ExpectedLatin1,

    LengthMismatch,
}

impl ser::Error for Error {
    fn custom<T: Display>(msg: T) -> Self {
        Error::Message(msg.to_string())
    }
}

impl de::Error for Error {
    fn custom<T: Display>(msg: T) -> Self {
        Error::Message(msg.to_string())
    }
}

impl Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Error::Message(msg) => formatter.write_str(msg),
            err => formatter.write_str(format!("serde_v8 error: {:?}", err).as_ref()),
        }
    }
}

impl std::error::Error for Error {}
