import re
from xml.etree import ElementTree


MAX_SVG_BYTES = 1_048_576
MAX_SVG_ELEMENTS = 10_000

_FORBIDDEN_ELEMENTS = {"script", "foreignobject", "style"}
_EXTERNAL_REFERENCE_ATTRIBUTES = {"href", "src"}
_EXTERNAL_URL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//)", re.IGNORECASE)
_URL_FUNCTION = re.compile(r"url\s*\(", re.IGNORECASE)
_XML_DECLARATION = re.compile(r"^\s*<\?xml\s[^?]*\?>", re.IGNORECASE)


class InvalidSvg(ValueError):
    pass


def validate_svg(svg: str) -> None:
    """CairoSVG에 전달하기 전에 외부 리소스와 실행 가능한 SVG 기능을 차단한다."""
    if len(svg.encode("utf-8")) > MAX_SVG_BYTES:
        raise InvalidSvg("SVG exceeds the 1 MB limit.")

    lowered = svg.lower()
    if re.search(r"<!\s*(?:doctype|entity)\b", lowered):
        raise InvalidSvg("DTD and entity declarations are not allowed.")

    without_declaration = _XML_DECLARATION.sub("", svg, count=1)
    if "<?" in without_declaration:
        raise InvalidSvg("XML processing instructions are not allowed.")

    try:
        root = ElementTree.fromstring(svg)
    except (ElementTree.ParseError, ValueError) as exc:
        raise InvalidSvg("SVG is not well-formed XML.") from exc

    if _local_name(root.tag) != "svg":
        raise InvalidSvg("The root element must be svg.")

    for index, element in enumerate(root.iter(), start=1):
        if index > MAX_SVG_ELEMENTS:
            raise InvalidSvg("SVG contains too many elements.")
        if _local_name(element.tag) in _FORBIDDEN_ELEMENTS:
            raise InvalidSvg("SVG contains a forbidden element.")

        for raw_name, raw_value in element.attrib.items():
            name = _local_name(raw_name)
            value = raw_value.strip()
            if name == "style" or name.startswith("on"):
                raise InvalidSvg("SVG contains a forbidden attribute.")
            if _URL_FUNCTION.search(value):
                raise InvalidSvg("CSS URL references are not allowed.")
            if _EXTERNAL_URL.match(value):
                raise InvalidSvg("External URLs are not allowed.")
            if name in _EXTERNAL_REFERENCE_ATTRIBUTES and value:
                if not value.startswith("#"):
                    raise InvalidSvg("External references are not allowed.")


def _local_name(name: str) -> str:
    return name.rsplit("}", 1)[-1].lower()
