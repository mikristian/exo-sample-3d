//! Deterministic, bounded millimetre arithmetic for saved native 2D charts.
//! No scripting, implicit units, functions or caller-supplied dependent values.
use crate::fitting::NativeDraftMeasurement;
use std::collections::{BTreeMap, BTreeSet};

const LIMIT: f64 = 1e9;

struct Parser<'a> {
    bytes: &'a [u8],
    offset: usize,
    tokens: usize,
    graph: &'a BTreeMap<String, NativeDraftMeasurement>,
    values: &'a mut BTreeMap<String, f64>,
    visiting: &'a mut BTreeSet<String>,
}

impl Parser<'_> {
    fn whitespace(&mut self) {
        while self.offset < self.bytes.len() && self.bytes[self.offset].is_ascii_whitespace() {
            self.offset += 1;
        }
    }
    fn token(&mut self) -> Result<(), String> {
        self.tokens += 1;
        if self.tokens > 512 { return Err("Native formula exceeds 512 tokens".into()); }
        Ok(())
    }
    fn take(&mut self, ch: u8) -> Result<bool, String> {
        self.whitespace();
        if self.bytes.get(self.offset) == Some(&ch) {
            self.offset += 1;
            self.token()?;
            Ok(true)
        } else { Ok(false) }
    }
    fn bounded(value: f64) -> Result<f64, String> {
        if !value.is_finite() || value.abs() > LIMIT {
            Err("Native formula result is nonfinite or exceeds 1e9 mm".into())
        } else { Ok(value) }
    }
    fn primary(&mut self, depth: usize) -> Result<f64, String> {
        if depth > 64 { return Err("Native formula nesting exceeds 64".into()); }
        if self.take(b'+')? { return self.primary(depth + 1); }
        if self.take(b'-')? { return Self::bounded(-self.primary(depth + 1)?); }
        if self.take(b'(')? {
            let value = self.expression(depth + 1)?;
            if !self.take(b')')? { return Err("Unclosed native formula parenthesis".into()); }
            return Ok(value);
        }
        self.whitespace();
        let start = self.offset;
        if self.bytes.get(start).is_some_and(|c| c.is_ascii_digit() || *c == b'.') {
            let mut digits = 0;
            while self.bytes.get(self.offset).is_some_and(u8::is_ascii_digit) {
                self.offset += 1; digits += 1;
            }
            if self.bytes.get(self.offset) == Some(&b'.') {
                self.offset += 1;
                while self.bytes.get(self.offset).is_some_and(u8::is_ascii_digit) {
                    self.offset += 1; digits += 1;
                }
            }
            if digits == 0 { return Err("Invalid native numeric literal".into()); }
            if self.bytes.get(self.offset).is_some_and(|c| *c == b'e' || *c == b'E') {
                self.offset += 1;
                if self.bytes.get(self.offset).is_some_and(|c| *c == b'+' || *c == b'-') { self.offset += 1; }
                let exponent_start = self.offset;
                while self.bytes.get(self.offset).is_some_and(u8::is_ascii_digit) { self.offset += 1; }
                if exponent_start == self.offset { return Err("Invalid native numeric exponent".into()); }
            }
            self.token()?;
            let text = std::str::from_utf8(&self.bytes[start..self.offset]).map_err(|e| e.to_string())?;
            return Self::bounded(text.parse::<f64>().map_err(|_| "Invalid native numeric literal")?);
        }
        if self.bytes.get(start).is_some_and(|c| c.is_ascii_alphabetic() || *c == b'_') {
            self.offset += 1;
            while self.bytes.get(self.offset).is_some_and(|c| c.is_ascii_alphanumeric() || *c == b'_') { self.offset += 1; }
            self.token()?;
            let name = std::str::from_utf8(&self.bytes[start..self.offset]).map_err(|e| e.to_string())?;
            if name.len() > 64 { return Err("Native formula identifier exceeds 64 bytes".into()); }
            return evaluate_named(name, self.graph, self.values, self.visiting);
        }
        Err("Expected native numeric literal, measurement or parenthesis".into())
    }
    fn product(&mut self, depth: usize) -> Result<f64, String> {
        let mut left = self.primary(depth)?;
        loop {
            if self.take(b'*')? { left = Self::bounded(left * self.primary(depth + 1)?)?; }
            else if self.take(b'/')? {
                let right = self.primary(depth + 1)?;
                if right == 0.0 { return Err("Native formula division by zero".into()); }
                left = Self::bounded(left / right)?;
            } else { break; }
        }
        Ok(left)
    }
    fn expression(&mut self, depth: usize) -> Result<f64, String> {
        if depth > 64 { return Err("Native formula nesting exceeds 64".into()); }
        let mut left = self.product(depth)?;
        loop {
            if self.take(b'+')? { left = Self::bounded(left + self.product(depth + 1)?)?; }
            else if self.take(b'-')? { left = Self::bounded(left - self.product(depth + 1)?)?; }
            else { break; }
        }
        Ok(left)
    }
}

fn evaluate_named(
    name: &str,
    graph: &BTreeMap<String, NativeDraftMeasurement>,
    values: &mut BTreeMap<String, f64>,
    visiting: &mut BTreeSet<String>,
) -> Result<f64, String> {
    if let Some(value) = values.get(name) { return Ok(*value); }
    if !visiting.insert(name.into()) { return Err(format!("Circular native measurement formula: {name}")); }
    if visiting.len() > 64 { return Err("Native formula graph depth exceeds 64".into()); }
    let entry = graph.get(name).ok_or_else(|| format!("Unknown native formula measurement: {name}"))?;
    let value = match entry {
        NativeDraftMeasurement::Number(n) => *n,
        NativeDraftMeasurement::Definition(def) if def.formula.is_none() =>
            def.value_mm.ok_or("Missing native direct measurement")?,
        NativeDraftMeasurement::Definition(def) => {
            let expression = def.formula.as_deref().ok_or("Missing native formula")?;
            if expression.is_empty() || expression.len() > 1024 || !expression.is_ascii() {
                return Err("Invalid native formula source length or characters".into());
            }
            let mut parser = Parser { bytes: expression.as_bytes(), offset: 0, tokens: 0,
                graph, values, visiting };
            let result = parser.expression(0)?;
            parser.whitespace();
            if parser.offset != parser.bytes.len() { return Err("Trailing native formula tokens".into()); }
            result
        }
    };
    let value = Parser::bounded(value)?;
    visiting.remove(name);
    values.insert(name.into(), value);
    Ok(value)
}

/// Evaluate every persisted formula, including ones not currently bound to a
/// point. A broken or cyclic chart refuses the entire native edit transaction.
pub fn evaluate_native_measurements_20261027(
    graph: &BTreeMap<String, NativeDraftMeasurement>,
) -> Result<BTreeMap<String, f64>, String> {
    if graph.is_empty() || graph.len() > 64 { return Err("Invalid native formula graph size".into()); }
    let mut values = BTreeMap::new();
    let mut visiting = BTreeSet::new();
    for name in graph.keys() { evaluate_named(name, graph, &mut values, &mut visiting)?; }
    Ok(values)
}

/// Parse one directly named source with an optional positive multiplier and
/// constant displacement. Signed source names, dependencies and parenthesized
/// expressions are excluded by this deliberately small inverse grammar.
fn single_direct_affine_20261027<'a>(
    graph: &'a BTreeMap<String, NativeDraftMeasurement>,
    expression: &'a str,
) -> Result<(&'a str, f64, f64, f64), String> {
    fn direct(graph: &BTreeMap<String, NativeDraftMeasurement>, name: &str) -> Option<f64> {
        if name.is_empty() || name.len() > 64
            || !name.bytes().next().is_some_and(|c| c.is_ascii_alphabetic() || c == b'_')
            || !name.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_') {
            return None;
        }
        match graph.get(name) {
            Some(NativeDraftMeasurement::Number(value)) => Some(*value),
            Some(NativeDraftMeasurement::Definition(def)) if def.formula.is_none() => def.value_mm,
            _ => None,
        }
    }
    fn literal(s: &str) -> Option<f64> {
        let s = s.trim();
        if s.is_empty() || !s.bytes().all(|c| c.is_ascii_digit() || c == b'.')
            || s.bytes().filter(|c| *c == b'.').count() > 1
            || !s.bytes().any(|c| c.is_ascii_digit()) { return None; }
        s.parse::<f64>().ok().filter(|n| n.is_finite() && n.abs() <= LIMIT)
    }
    let expression = expression.trim();
    if expression.len() > 1024 || !expression.is_ascii() { return Err("Invalid inverse formula source".into()); }
    // The only accepted arithmetic form is `<term> [+|-] <unsigned literal>`.
    // A sign cannot be part of a token, and an extra operator is rejected.
    let split = expression.bytes().position(|c| c == b'+' || c == b'-');
    let (term, displacement) = match split {
        Some(pos) => {
            let right = literal(&expression[pos + 1..]).ok_or("Affine inverse requires a finite constant offset")?;
            (&expression[..pos], if expression.as_bytes()[pos] == b'-' { -right } else { right })
        }
        None => (expression, 0.),
    };
    let factors: Vec<_> = term.split('*').map(str::trim).collect();
    let (name, source, multiplier) = match factors.as_slice() {
        [name] => (*name, direct(graph, name), Some(1.)),
        [left, right] => {
            if let Some(value) = direct(graph, left) {
                (*left, Some(value), literal(right))
            } else if let Some(value) = direct(graph, right) {
                (*right, Some(value), literal(left))
            } else { return Err("Affine inverse requires one directly named source".into()); }
        }
        _ => return Err("Affine inverse requires one direct source and one constant multiplier".into()),
    };
    let prior = source.ok_or("Affine inverse requires a saved direct source")?;
    let scale = multiplier.ok_or("Affine inverse requires a numeric multiplier")?;
    if !(0.1..=100.).contains(&scale) || !prior.is_finite()
        || !(0.001..=5000.).contains(&prior) || displacement.abs() > 5000. {
        return Err("Affine inverse multiplier, offset or source is outside physical bounds".into());
    }
    Ok((name, prior, scale, displacement))
}

/// Strict, unique inverse for one authored positive affine direct formula.
/// No numerical root finding, inferred formula replacement, or arbitrary
/// expression inversion: the complete saved graph is re-evaluated in Rust.
/// Other formula expressions remain intentionally non-invertible.
pub fn infer_scaled_direct_measurement_20261027(
    graph: &BTreeMap<String, NativeDraftMeasurement>,
    computed: &str,
    target_mm: f64,
) -> Result<(String, f64), String> {
    if !target_mm.is_finite() || !(0.001..=5000.).contains(&target_mm) {
        return Err("Invalid inverse computed measurement target".into());
    }
    let expression = match graph.get(computed) {
        Some(NativeDraftMeasurement::Definition(def)) => def.formula.as_deref()
            .ok_or("Inverse requires saved computed formula")?,
        _ => return Err("Inverse requires saved computed formula".into()),
    };
    let (name, prior, scale, displacement) = single_direct_affine_20261027(graph, expression)?;
    let before = evaluate_native_measurements_20261027(graph)?;
    if (before[computed] - (prior * scale + displacement)).abs() > 1e-8 {
        return Err("Saved computed formula disagrees with affine source".into());
    }
    let inferred = (target_mm - displacement) / scale;
    if !inferred.is_finite() || !(0.001..=5000.).contains(&inferred)
        || (inferred - prior).abs() <= 1e-8 {
        return Err("Scaled inverse is unchanged or outside physical bounds".into());
    }
    let mut candidate = graph.clone();
    match candidate.get_mut(name).ok_or("Scaled inverse direct source disappeared")? {
        NativeDraftMeasurement::Number(value) => *value = inferred,
        NativeDraftMeasurement::Definition(def) if def.formula.is_none() => def.value_mm = Some(inferred),
        _ => return Err("Scaled inverse source changed identity".into()),
    }
    let after = evaluate_native_measurements_20261027(&candidate)?;
    if (after[computed] - target_mm).abs() > 1e-7 {
        return Err("Scaled inverse does not reproduce requested computed measurement".into());
    }
    Ok((name.into(), inferred))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fitting::NativeDraftMeasurementDefinition as Def;
    fn direct(n: f64) -> NativeDraftMeasurement { NativeDraftMeasurement::Number(n) }
    fn formula(s: &str) -> NativeDraftMeasurement {
        NativeDraftMeasurement::Definition(Def { formula: Some(s.into()), value_mm: None })
    }
    #[test]
    fn evaluates_nested_dependency_arithmetic_and_scientific_notation() {
        let graph = BTreeMap::from([
            ("chest".into(), direct(920.)),
            ("ease".into(), direct(20.)),
            ("quarter".into(), formula("(chest + ease) / 4")),
            ("cut".into(), formula("quarter + 1.5e1 - -5")),
        ]);
        let result = evaluate_native_measurements_20261027(&graph).unwrap();
        assert_eq!(result["quarter"], 235.);
        assert_eq!(result["cut"], 255.);
    }
    #[test]
    fn rejects_cycles_missing_names_division_by_zero_and_unsafe_tokens() {
        for expression in ["bad + 1", "1 / (chest - chest)", "chest ** 2", "chest + 1; 2", "1e+", "(chest", "chest + 1e999"] {
            let graph = BTreeMap::from([("chest".into(), direct(920.)), ("width".into(), formula(expression))]);
            assert!(evaluate_native_measurements_20261027(&graph).is_err(), "{expression}");
        }
        let cycle = BTreeMap::from([("a".into(), formula("b + 1")), ("b".into(), formula("a - 1"))]);
        assert!(evaluate_native_measurements_20261027(&cycle).is_err());
        let depth = BTreeMap::from([("a".into(), formula(&format!("{}1{}", "(".repeat(65), ")".repeat(65))))]);
        assert!(evaluate_native_measurements_20261027(&depth).is_err());
    }
    #[test]
    fn scaled_direct_inverse_recomputes_saved_formula_without_replacing_identity() {
        for formula in ["halfWidth * 2", "2 * halfWidth", "halfWidth*2.0"] {
            let graph = BTreeMap::from([
                ("halfWidth".into(), direct(200.)),
                ("width".into(), self::formula(formula)),
                ("seam".into(), self::formula("width + 10")),
            ]);
            let (name, value) = infer_scaled_direct_measurement_20261027(&graph, "width", 410.).unwrap();
            assert_eq!(name, "halfWidth");
            assert!((value - 205.).abs() < 1e-9);
            assert_eq!(evaluate_native_measurements_20261027(&graph).unwrap()["width"], 400.);
        }
    }
    #[test]
    fn affine_direct_inverse_preserves_exact_formula_and_forward_dependents() {
        for (expression, target, expected) in [
            ("halfWidth * 2 + 10", 430., 210.),
            ("2 * halfWidth - 10", 410., 210.),
            ("halfWidth + 200", 410., 210.),
            ("halfWidth*2.0+10.5", 430.5, 210.),
        ] {
            let graph = BTreeMap::from([
                ("halfWidth".into(), direct(200.)),
                ("width".into(), formula(expression)),
                ("seam".into(), formula("width + 10")),
            ]);
            let (name, inferred) = infer_scaled_direct_measurement_20261027(&graph, "width", target).unwrap();
            assert_eq!(name, "halfWidth");
            assert!((inferred - expected).abs() < 1e-9);
            let mut changed = graph.clone();
            changed.insert(name, direct(inferred));
            match &changed["width"] {
                NativeDraftMeasurement::Definition(def) => assert_eq!(def.formula.as_deref(), Some(expression)),
                _ => panic!("Computed formula was not preserved"),
            }
            let forward = evaluate_native_measurements_20261027(&changed).unwrap();
            assert!((forward["width"] - target).abs() < 1e-8);
            assert!((forward["seam"] - target - 10.).abs() < 1e-8);
        }
    }
    #[test]
    fn scaled_inverse_rejects_nonlinear_ambiguous_invalid_and_unphysical_cases() {
        for formula in ["halfWidth * halfWidth", "halfWidth * 0",
            "halfWidth * -2", "halfWidth / 2", "halfWidth * 2 * 1",
            "(halfWidth) * 2", "halfWidth * 1e309", "halfWidth * 0.0001",
            "halfWidth * unknown", "halfWidth * 2 + other", "halfWidth + halfWidth",
            "halfWidth * 2 + 1 + 1", "halfWidth * 2 - 9000", "halfWidth * 2 + 1e9",
            "halfWidth * 2 + -1", "halfWidth * 2.0 / 1", "halfWidth * 2 + width"] {
            let graph = BTreeMap::from([
                ("halfWidth".into(), direct(200.)),
                ("width".into(), self::formula(formula)),
            ]);
            assert!(infer_scaled_direct_measurement_20261027(&graph,"width",410.).is_err(),"{formula}");
        }
        let graph = BTreeMap::from([
            ("halfWidth".into(),direct(200.)),
            ("width".into(),self::formula("halfWidth * 2")),
        ]);
        for target in [f64::NAN, f64::INFINITY, -10., 0., 400., 10001.] {
            assert!(infer_scaled_direct_measurement_20261027(&graph,"width",target).is_err());
        }
    }
}
