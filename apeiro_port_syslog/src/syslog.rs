use std::{collections::HashMap, net::SocketAddr, str};

use chrono::{prelude::*, serde::ts_seconds_option};
use serde::{Deserialize, Serialize};

// ASL facility codes
const LOG_KERN: u8 = 0;
const LOG_USER: u8 = 1;
const LOG_MAIL: u8 = 2;
const LOG_DAEMON: u8 = 3;
const LOG_AUTH: u8 = 4;
const LOG_SYSLOG: u8 = 5;
const LOG_LPR: u8 = 6;
const LOG_NEWS: u8 = 7;
const LOG_UUCP: u8 = 8;
const LOG_CRON: u8 = 9;
const LOG_AUTHPRIV: u8 = 10;
const LOG_FTP: u8 = 11;
const LOG_NETINFO: u8 = 12;
const LOG_REMOTEAUTH: u8 = 13;
const LOG_INSTALL: u8 = 14;
// unused const LOG_RAS: u8 = 15;
const LOG_LOCAL0: u8 = 16;
const LOG_LOCAL1: u8 = 17;
const LOG_LOCAL2: u8 = 18;
const LOG_LOCAL3: u8 = 19;
const LOG_LOCAL4: u8 = 20;
const LOG_LOCAL5: u8 = 21;
const LOG_LOCAL6: u8 = 22;
const LOG_LOCAL7: u8 = 23;
const LOG_LAUNCHD: u8 = 24;

trait SliceExt {
    fn slice_until_space(&self) -> &Self;
    fn slice_between_arrows(&self) -> &Self;
    fn slice_between_brackets(&self) -> &Self;
}

impl SliceExt for [u8] {
    fn slice_until_space(&self) -> &[u8] {
        fn is_whitespace(c: &u8) -> bool {
            *c == b' '
        }

        fn is_not_whitespace(c: &u8) -> bool {
            !is_whitespace(c)
        }

        if let Some(first) = self.iter().position(is_not_whitespace) {
            if let Some(space) = self.iter().position(is_whitespace) {
                &self[first..space]
            } else {
                &self[first..]
            }
        } else {
            &[]
        }
    }

    fn slice_between_arrows(&self) -> &[u8] {
        fn is_left_arrow(c: &u8) -> bool {
            *c == b'<'
        }

        fn is_right_arrow(c: &u8) -> bool {
            *c == b'>'
        }

        if let Some(left) = self.iter().position(is_left_arrow) {
            if let Some(right) = self.iter().position(is_right_arrow) {
                &self[left..right + 1]
            } else {
                &[]
            }
        } else {
            &[]
        }
    }

    fn slice_between_brackets(&self) -> &[u8] {
        fn is_left_bracket(c: &u8) -> bool {
            *c == b'['
        }

        fn is_right_bracket(c: &u8) -> bool {
            *c == b']'
        }

        if let Some(left) = self.iter().position(is_left_bracket) {
            if let Some(right) = self.iter().position(is_right_bracket) {
                &self[left..right + 1]
            } else {
                &[]
            }
        } else {
            &[]
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SyslogMsg {
    from: SocketAddr,
    facility: u8,
    severity: u8,
    version: u8,
    #[serde(with = "ts_seconds_option")]
    timestamp: Option<DateTime<Utc>>,
    hostname: Option<String>,
    appname: Option<String>,
    procid: Option<String>,
    msgid: Option<String>,
    sdata: Option<HashMap<String, String>>,
    msg: Option<String>,
}

impl SyslogMsg {
    fn from_version_1(
        from: SocketAddr,
        len: usize,
        buf: &[u8],
        mut first: usize,
        vstr: &str,
        facility: u8,
        severity: u8,
    ) -> Option<Self> {
        first += vstr.len();
        let version = vstr.parse::<u8>().expect("version parse");

        while buf[first] == b' ' {
            first += 1;
        }

        let mut timestamp: Option<DateTime<Utc>> = None;
        if let Some(tstr) = syslog_parse_opt_string(buf, &mut first, &len) {
            timestamp = match DateTime::parse_from_rfc3339(&tstr) {
                Ok(ts) => Some(ts.with_timezone(&Utc)),
                Err(_why) => {
                    if tstr == "_" {
                        None
                    } else {
                        return None;
                    }
                }
            };
        };

        let hostname = syslog_parse_opt_string(buf, &mut first, &len);
        let appname = syslog_parse_opt_string(buf, &mut first, &len);
        let procid = syslog_parse_opt_string(buf, &mut first, &len);
        let msgid = syslog_parse_opt_string(buf, &mut first, &len);

        // structured data may be missing ("-") or will be enclosed in "[", "]"
        let sd: Option<HashMap<String, String>> = if buf[first] == b'-' {
            first += 2;
            None
        } else {
            let kv_str = buf[first..len].slice_between_brackets();
            let kv_len = kv_str.len();
            if kv_len != 0 {
                first += kv_len;
                eprintln!("todo: parse sd");
            }
            None
        };

        // the remainder of buf
        let msg = match String::from_utf8(buf[first..len].to_vec()) {
            Ok(m) => Some(m),
            Err(_why) => None,
        };
        Some(SyslogMsg {
            from: from,
            facility: facility,
            severity: severity,
            version: version,
            timestamp: timestamp,
            hostname: hostname,
            appname: appname,
            procid: procid,
            msgid: msgid,
            sdata: sd,
            msg: msg,
        })
    }

    fn from_bsd(
        from: SocketAddr,
        len: usize,
        buf: &[u8],
        mut first: usize,
        facility: u8,
        severity: u8,
    ) -> Option<Self> {
        let local: DateTime<Local> = Local::now();
        let ts = format!(
            "{} {}",
            local.format("%z %Y"),
            str::from_utf8(&buf[first..first + 15]).unwrap()
        );
        first += 15;
        let timestamp = match DateTime::parse_from_str(&ts, "%z %Y %b %e %H:%M:%S") {
            Ok(ts) => ts,
            Err(_why) => return None,
        };

        while buf[first] == b' ' {
            first += 1;
        }
        let hostname = syslog_parse_opt_string(buf, &mut first, &len);

        // the remainder of buf
        let msg = match String::from_utf8(buf[first..len].to_vec()) {
            Ok(m) => Some(m),
            Err(_why) => None,
        };

        Some(SyslogMsg {
            from: from,
            facility: facility,
            severity: severity,
            version: 0,
            timestamp: Some(timestamp.with_timezone(&Utc)),
            hostname: hostname,
            appname: None,
            procid: None,
            msgid: None,
            sdata: None,
            msg: msg,
        })
    }

    fn from_asl(from: SocketAddr, len: usize, buf: &[u8]) -> Option<Self> {
        fn syslog_parse_asl_facility_name(name: &str) -> u8 {
            match name {
                "auth" => LOG_AUTH,
                "authpriv" => LOG_AUTHPRIV,
                "cron" => LOG_CRON,
                "daemon" => LOG_DAEMON,
                "ftp" => LOG_FTP,
                "install" => LOG_INSTALL,
                "kern" => LOG_KERN,
                "lpr" => LOG_LPR,
                "mail" => LOG_MAIL,
                "netinfo" => LOG_NETINFO,
                "remoteauth" => LOG_REMOTEAUTH,
                "news" => LOG_NEWS,
                "security" => LOG_AUTH,
                "syslog" => LOG_SYSLOG,
                "user" => LOG_USER,
                "uucp" => LOG_UUCP,
                "local0" => LOG_LOCAL0,
                "local1" => LOG_LOCAL1,
                "local2" => LOG_LOCAL2,
                "local3" => LOG_LOCAL3,
                "local4" => LOG_LOCAL4,
                "local5" => LOG_LOCAL5,
                "local6" => LOG_LOCAL6,
                "local7" => LOG_LOCAL7,
                "launchd" => LOG_LAUNCHD,
                _ => LOG_USER,
            }
        }

        let mut first = 0;
        let lenstr = match str::from_utf8(&buf[0..10]) {
            Ok(s) => s,
            Err(_why) => return None,
        };
        let mut msglen: usize = match lenstr.trim().parse() {
            Ok(m) => m,
            Err(_why) => return None,
        };
        first += lenstr.len() + 1;

        let mut sdata: HashMap<String, String> = HashMap::new();
        while msglen > 0 {
            let kv_str = buf[first..len].slice_between_brackets();
            let kv_len = kv_str.len();
            if kv_len == 0 {
                break;
            }
            msglen -= kv_len;
            first += kv_len;

            while buf[first] == b' ' {
                msglen -= 1;
                first += 1;
            }
            let pair: Vec<&str> = str::from_utf8(&kv_str[1..kv_len - 1])
                .unwrap()
                .splitn(2, ' ')
                .collect();
            sdata.insert(pair[0].to_string(), pair[1].to_string());
        }
        let severity = match sdata.remove("Level") {
            Some(val) => match val.parse() {
                Ok(num) => num,
                Err(_e) => return None,
            },
            None => 7,
        };
        let facility = match sdata.remove("Facility") {
            Some(val) => syslog_parse_asl_facility_name(&val),
            None => LOG_USER,
        };
        let time_sec: i64 = match sdata.remove("Time") {
            Some(val) => match val.parse() {
                Ok(num) => num,
                Err(_e) => return None,
            },
            None => 0,
        };
        let time_nanosec: u32 = match sdata.remove("TimeNanoSec") {
            Some(val) => match val.parse() {
                Ok(num) => num,
                Err(_e) => return None,
            },
            None => 0,
        };
        let hostname: Option<String> = match sdata.remove("Host") {
            Some(val) => Some(val.to_string()),
            None => None,
        };
        let appname: Option<String> = match sdata.remove("Sender") {
            Some(val) => Some(val.to_string()),
            None => None,
        };
        let procid: Option<String> = match sdata.remove("PID") {
            Some(val) => Some(val.to_string()),
            None => None,
        };
        let msg: Option<String> = match sdata.remove("Message") {
            Some(val) => Some(val.to_string()),
            None => None,
        };
        let timestamp = Utc.timestamp_opt(time_sec, time_nanosec).unwrap();
        return Some(SyslogMsg {
            from: from,
            facility: facility,
            severity: severity,
            version: 0,
            timestamp: Some(timestamp),
            hostname: hostname,
            appname: appname,
            procid: procid,
            msgid: None,
            msg: msg,
            sdata: Some(sdata),
        });
    }
}

fn syslog_parse_pri(pri_with_arrows: &[u8]) -> Option<(u8, u8)> {
    let len = pri_with_arrows.len();
    if len < 3 || len > 5 {
        return None;
    }
    let pri_str = str::from_utf8(&pri_with_arrows[1..len - 1]).unwrap();
    let num: i32 = pri_str.parse().unwrap();
    let facility = num / 8;
    let severity = num % 8;
    Some((facility as u8, severity as u8))
}

fn syslog_parse_opt_string(buf: &[u8], first: &mut usize, len: &usize) -> Option<String> {
    let val = match String::from_utf8(buf[*first..*len].slice_until_space().to_vec()) {
        Ok(v) => {
            let vlen = v.len();
            *first += vlen;
            if vlen == 1 && v == "-" {
                None
            } else {
                Some(v)
            }
        }
        Err(_why) => return None,
    };

    while *first < *len && buf[*first] == b' ' {
        *first += 1;
    }
    val
}

fn syslog_version_1(version: &str) -> bool {
    version == "1"
}

// In old BSD syle, a three letter abreviation of the month capitalized follows the priority. Test for this.
fn syslog_bsd_style(month: &str) -> bool {
    let months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    months.contains(&month)
}

// decode packet
pub fn parse(from: SocketAddr, len: usize, buf: &[u8]) -> Option<SyslogMsg> {
    let mut first = 0;
    let pri_str = buf[first..len].slice_between_arrows();
    let pri_len = pri_str.len();

    // check for Apple Syslog Log (asl) format
    if pri_len == 0 {
        // the first 10 characters should be length of the asl message.
        if len < 10 {
            return None;
        }
        return SyslogMsg::from_asl(from, len, buf);
    }

    let (facility, severity) = match syslog_parse_pri(pri_str) {
        Some((f, s)) => (f, s),
        None => return None,
    };

    first += pri_len;

    let vstr = match str::from_utf8(buf[first..len].slice_until_space()) {
        Ok(s) => s,
        Err(_why) => return None,
    };
    if syslog_version_1(vstr) {
        // assume RFC 5424 format
        SyslogMsg::from_version_1(from, len, buf, first, vstr, facility, severity)
    } else if syslog_bsd_style(vstr) {
        // assume RFC 3164 format
        SyslogMsg::from_bsd(from, len, buf, first, facility, severity)
    } else {
        None
    }
}
